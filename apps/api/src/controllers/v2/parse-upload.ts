import crypto from "node:crypto";
import path from "node:path";
import { Request, Response, NextFunction } from "express";
import { Storage } from "@google-cloud/storage";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { config } from "../../config";
import { logger as _logger } from "../../lib/logger";
import { withSpan, setSpanAttributes } from "../../lib/otel-tracer";
import { RequestWithAuth, UploadedParseFile } from "./types";
import { detectUploadedFileKind } from "./parse";

const PARSE_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
const PARSE_UPLOAD_TTL_MS = 10 * 60 * 1000;
const uploadInitSchema = z.strictObject({
  filename: z.string().min(1).max(512),
  contentType: z.string().min(1).max(255).optional(),
  declaredSizeBytes: z
    .number()
    .int()
    .positive()
    .max(PARSE_UPLOAD_MAX_BYTES)
    .optional(),
});

type ParseUploadDriver = "local" | "gcs";

type ParseUploadRefPayload = {
  v: 1;
  driver: ParseUploadDriver;
  uploadId: string;
  teamId: string;
  objectPath: string;
  filename: string;
  contentType?: string;
  expiresAt: number;
  maxBytes: number;
};

type LocalUploadRecord = {
  buffer?: Buffer;
  filename: string;
  contentType?: string;
  teamId: string;
  expiresAt: number;
  maxBytes: number;
};

const localUploads = new Map<string, LocalUploadRecord>();

function getParseUploadDriver(): ParseUploadDriver {
  if (config.PARSE_UPLOAD_STORAGE_DRIVER === "gcs") return "gcs";
  if (config.PARSE_UPLOAD_STORAGE_DRIVER === "local") return "local";
  if (config.GCS_PARSE_UPLOAD_BUCKET_NAME) return "gcs";
  return isLocalUploadAdapterAllowed() ? "local" : "gcs";
}

function getStorageClient() {
  const credentials = config.GCS_CREDENTIALS
    ? JSON.parse(atob(config.GCS_CREDENTIALS))
    : undefined;
  return new Storage({ credentials });
}

function isLocalUploadAdapterAllowed() {
  const env = config.ENV?.toLowerCase();
  return (
    env === "development" ||
    env === "test" ||
    env === "local" ||
    process.env.NODE_ENV === "test"
  );
}

function getEffectiveRefSecret(): string | null {
  if (!isLocalUploadAdapterAllowed())
    return config.PARSE_UPLOAD_REF_SECRET ?? null;
  return (
    config.PARSE_UPLOAD_REF_SECRET ??
    config.BULL_AUTH_KEY ??
    "development-parse-upload-ref-secret"
  );
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

function signUploadRef(payload: ParseUploadRefPayload): string {
  const secret = getEffectiveRefSecret();
  if (!secret) {
    throw new Error(
      "PARSE_UPLOAD_REF_SECRET is required for parse upload refs.",
    );
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

function verifyUploadRef(uploadRef: string): ParseUploadRefPayload {
  const secret = getEffectiveRefSecret();
  if (!secret) {
    throw new Error(
      "PARSE_UPLOAD_REF_SECRET is required for parse upload refs.",
    );
  }

  const [encodedPayload, signature, extra] = uploadRef.split(".");
  if (!encodedPayload || !signature || extra !== undefined) {
    throw new Error("Invalid uploadRef format.");
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid uploadRef signature.");
  }

  const decoded = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8"));
  const parsed = z
    .strictObject({
      v: z.literal(1),
      driver: z.enum(["local", "gcs"]),
      uploadId: z.string().min(1),
      teamId: z.string().min(1),
      objectPath: z.string().min(1),
      filename: z.string().min(1),
      contentType: z.string().optional(),
      expiresAt: z.number().int().positive(),
      maxBytes: z.number().int().positive().max(PARSE_UPLOAD_MAX_BYTES),
    })
    .parse(decoded);

  if (Date.now() > parsed.expiresAt) {
    throw new Error("uploadRef has expired.");
  }

  return parsed;
}

function sanitizeFilename(filename: string): string {
  const base = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base || "upload";
}

function isSupportedParseUpload(filename: string, contentType?: string) {
  return detectUploadedFileKind(filename, contentType) !== null;
}

function cleanupExpiredLocalUploads(now = Date.now()) {
  for (const [uploadId, record] of localUploads.entries()) {
    if (now > record.expiresAt) localUploads.delete(uploadId);
  }
}

function buildPublicBaseUrl(req: Request): string {
  const configured = config.PARSE_UPLOAD_PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  return `${req.protocol}://${req.get("host")}`;
}

function makeObjectPath(
  teamId: string,
  uploadId: string,
  filename: string,
): string {
  return `parse-uploads/${teamId}/${uploadId}/${sanitizeFilename(filename)}`;
}

export async function parseUploadUrlController(
  req: RequestWithAuth<{}, any, any>,
  res: Response,
) {
  return withSpan("api.parse.upload_url", async span => {
    const parsed = uploadInitSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        error:
          parsed.error.issues[0]?.message ?? "Invalid upload init request.",
      });
    }

    const { filename, contentType, declaredSizeBytes } = parsed.data;
    if (!isSupportedParseUpload(filename, contentType)) {
      return res.status(400).json({
        success: false,
        code: "UNSUPPORTED_FILE_TYPE",
        error:
          "Unsupported upload type. Supported file extensions include .html, .htm, .xhtml, .pdf, .docx, .doc, .odt, .rtf, .xlsx, .xls, or matching supported MIME types.",
      });
    }

    cleanupExpiredLocalUploads();
    const driver = getParseUploadDriver();
    if (!getEffectiveRefSecret()) {
      return res.status(503).json({
        success: false,
        code: "PARSE_UPLOAD_REF_SECRET_MISSING",
        error: "Parse upload references are not configured.",
      });
    }

    if (driver === "local" && !isLocalUploadAdapterAllowed()) {
      return res.status(503).json({
        success: false,
        code: "PARSE_UPLOAD_STORAGE_DISABLED",
        error:
          "Local parse upload storage is disabled outside development/test.",
      });
    }

    const uploadId = uuidv7();
    const expiresAt = Date.now() + PARSE_UPLOAD_TTL_MS;
    const objectPath = makeObjectPath(req.auth.team_id, uploadId, filename);
    const refPayload: ParseUploadRefPayload = {
      v: 1,
      driver,
      uploadId,
      teamId: req.auth.team_id,
      objectPath,
      filename: sanitizeFilename(filename),
      contentType,
      expiresAt,
      maxBytes: PARSE_UPLOAD_MAX_BYTES,
    };
    const uploadRef = signUploadRef(refPayload);

    setSpanAttributes(span, {
      "parse_upload.driver": driver,
      "parse_upload.team_id": req.auth.team_id,
      "parse_upload.declared_size": declaredSizeBytes,
    });

    if (driver === "gcs") {
      if (!config.GCS_PARSE_UPLOAD_BUCKET_NAME) {
        return res.status(503).json({
          success: false,
          code: "PARSE_UPLOAD_STORAGE_DISABLED",
          error: "Parse upload storage is not configured.",
        });
      }

      const bucket = getStorageClient().bucket(
        config.GCS_PARSE_UPLOAD_BUCKET_NAME,
      );
      const file = bucket.file(objectPath);
      const [policy] = await file.generateSignedPostPolicyV4({
        expires: expiresAt,
        fields: {
          "Content-Type": contentType || "application/octet-stream",
        },
        conditions: [
          ["content-length-range", 1, PARSE_UPLOAD_MAX_BYTES],
          ["eq", "$Content-Type", contentType || "application/octet-stream"],
        ],
      });

      return res.status(200).json({
        success: true,
        data: {
          uploadUrl: policy.url,
          uploadRef,
          method: "POST",
          headers: {},
          fields: policy.fields,
          expiresAt: new Date(expiresAt).toISOString(),
          maxSizeBytes: PARSE_UPLOAD_MAX_BYTES,
        },
      });
    }

    localUploads.set(uploadId, {
      filename: sanitizeFilename(filename),
      contentType,
      teamId: req.auth.team_id,
      expiresAt,
      maxBytes: PARSE_UPLOAD_MAX_BYTES,
    });

    return res.status(200).json({
      success: true,
      data: {
        uploadUrl: `${buildPublicBaseUrl(req)}/v2/parse/upload/${uploadId}?uploadRef=${encodeURIComponent(uploadRef)}`,
        uploadRef,
        method: "PUT",
        headers: {
          "Content-Type": contentType || "application/octet-stream",
        },
        expiresAt: new Date(expiresAt).toISOString(),
        maxSizeBytes: PARSE_UPLOAD_MAX_BYTES,
      },
    });
  });
}

export async function parseLocalUploadController(req: Request, res: Response) {
  if (!isLocalUploadAdapterAllowed()) {
    return res.status(404).json({
      success: false,
      code: "NOT_FOUND",
      error: "Local parse upload storage is disabled.",
    });
  }
  cleanupExpiredLocalUploads();

  const uploadRef =
    typeof req.query.uploadRef === "string" ? req.query.uploadRef : "";
  let payload: ParseUploadRefPayload;
  try {
    payload = verifyUploadRef(uploadRef);
  } catch (error) {
    return res.status(400).json({
      success: false,
      code: "BAD_REQUEST",
      error: error instanceof Error ? error.message : "Invalid uploadRef.",
    });
  }

  if (payload.driver !== "local" || payload.uploadId !== req.params.uploadId) {
    return res.status(400).json({
      success: false,
      code: "BAD_REQUEST",
      error: "uploadRef does not match this upload URL.",
    });
  }

  const record = localUploads.get(payload.uploadId);
  if (!record || record.teamId !== payload.teamId) {
    return res.status(404).json({
      success: false,
      code: "NOT_FOUND",
      error: "Upload URL not found or expired.",
    });
  }

  const body = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(req.body ?? "");
  if (body.length > record.maxBytes) {
    return res.status(400).json({
      success: false,
      code: "BAD_REQUEST",
      error: "Uploaded file exceeds maximum size of 50MB.",
    });
  }

  record.buffer = body;
  return res.status(200).json({ success: true });
}

async function resolveUploadRef(payload: ParseUploadRefPayload): Promise<{
  file: UploadedParseFile;
  cleanup: () => Promise<void>;
}> {
  if (payload.driver === "local") {
    cleanupExpiredLocalUploads();
    const record = localUploads.get(payload.uploadId);
    if (!record || record.teamId !== payload.teamId || !record.buffer) {
      throw new Error(
        "Uploaded file is not available. Upload the file before parsing.",
      );
    }
    if (record.buffer.length > payload.maxBytes) {
      throw new Error("Uploaded file exceeds maximum size of 50MB.");
    }

    const kind = detectUploadedFileKind(payload.filename, payload.contentType);
    if (!kind) {
      throw new Error("Unsupported upload type.");
    }

    return {
      file: {
        buffer: record.buffer,
        filename: payload.filename,
        contentType: payload.contentType,
        kind,
      },
      cleanup: async () => {
        localUploads.delete(payload.uploadId);
      },
    };
  }

  if (!config.GCS_PARSE_UPLOAD_BUCKET_NAME) {
    throw new Error("Parse upload storage is not configured.");
  }

  const file = getStorageClient()
    .bucket(config.GCS_PARSE_UPLOAD_BUCKET_NAME)
    .file(payload.objectPath);
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size ?? 0);
  if (!Number.isFinite(size) || size > payload.maxBytes) {
    throw new Error("Uploaded file exceeds maximum size of 50MB.");
  }

  const [buffer] = await file.download();
  if (buffer.length > payload.maxBytes) {
    throw new Error("Uploaded file exceeds maximum size of 50MB.");
  }

  const kind = detectUploadedFileKind(payload.filename, payload.contentType);
  if (!kind) {
    throw new Error("Unsupported upload type.");
  }

  return {
    file: {
      buffer,
      filename: payload.filename,
      contentType: payload.contentType,
      kind,
    },
    cleanup: async () => {
      try {
        await file.delete({ ignoreNotFound: true });
      } catch (error) {
        _logger.warn("Failed to clean up parse upload object", {
          error,
          uploadId: payload.uploadId,
        });
      }
    },
  };
}

export async function parseUploadRefPayloadMiddleware(
  req: RequestWithAuth<{}, any, any>,
  res: Response,
  next: NextFunction,
) {
  const uploadRef = req.body?.uploadRef;
  if (typeof uploadRef !== "string" || uploadRef.length === 0) {
    res.status(400).json({
      success: false,
      code: "BAD_REQUEST",
      error:
        "Missing file upload. Send multipart/form-data with a 'file' field, or JSON with an 'uploadRef'.",
    });
    return;
  }

  let payload: ParseUploadRefPayload;
  try {
    payload = verifyUploadRef(uploadRef);
  } catch (error) {
    res.status(400).json({
      success: false,
      code: "BAD_REQUEST",
      error: error instanceof Error ? error.message : "Invalid uploadRef.",
    });
    return;
  }

  if (payload.teamId !== req.auth.team_id) {
    res.status(403).json({
      success: false,
      code: "FORBIDDEN",
      error: "uploadRef does not belong to the authenticated team.",
    });
    return;
  }

  try {
    const resolved = await resolveUploadRef(payload);
    const { uploadRef: _uploadRef, ...options } = req.body;
    req.body = {
      ...options,
      file: resolved.file,
    };
    res.once("finish", () => {
      resolved.cleanup().catch(error => {
        _logger.warn("Failed to clean up parse upload", {
          error,
          uploadId: payload.uploadId,
        });
      });
    });
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      code: "BAD_REQUEST",
      error:
        error instanceof Error ? error.message : "Failed to resolve uploadRef.",
    });
  }
}
