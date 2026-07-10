import { randomUUID } from "crypto";
import { vi } from "vitest";

const controls = vi.hoisted(() => ({ fdbFlag: false, pgResidue: 0 }));

vi.mock("../../controllers/auth", () => ({
  getACUCTeam: vi.fn(async () => ({ flags: { nuqFdb: controls.fdbFlag } })),
}));
vi.mock("../../lib/deployment", () => ({ isSelfHosted: vi.fn(() => false) }));
vi.mock("../../services/worker/nuq", () => {
  const queue = {
    getJob: vi.fn().mockResolvedValue(null),
    getJobs: vi.fn().mockResolvedValue([]),
    getJobsFromBacklog: vi.fn().mockResolvedValue([]),
    getJobToProcess: vi.fn().mockResolvedValue(null),
  };
  return {
    scrapeQueue: queue,
    crawlFinishedQueue: queue,
    crawlGroup: {
      getGroup: vi.fn().mockResolvedValue(null),
      getOngoingByOwner: vi.fn().mockResolvedValue([]),
    },
    getNuQPgOwnerLiveResidue: vi.fn(async () => ({
      scrape: controls.pgResidue,
      backlog: 0,
      groups: 0,
      crawlFinished: 0,
      total: controls.pgResidue,
    })),
  };
});
vi.mock("../../lib/concurrency-redis", () => ({
  getTeamQueueLimit: vi.fn().mockResolvedValue(100),
  getConcurrencyLimitActiveJobsCount: vi.fn().mockResolvedValue(0),
  pushConcurrencyLimitActiveJob: vi.fn(),
  removeConcurrencyLimitActiveJob: vi.fn(),
  constructConcurrencyLimitKey: vi.fn((teamId: string) => `limit:${teamId}`),
}));

import { config } from "../../config";
import { isFdbTeam } from "../../services/worker/nuq-router";
import {
  crawlFinishedQueueFdb,
  nuqFdbMigrationStore,
  scrapeQueueFdb,
} from "../../services/worker/nuq-fdb";
import {
  getFdb,
  getNuqFdbDatabase,
} from "../../services/worker/nuq-fdb/client";

const describeIf = config.FDB_CLUSTER_FILE ? describe : describe.skip;
const teams = new Set<string>();
const previousBackend = config.NUQ_BACKEND;

async function clearTeam(teamId: string): Promise<void> {
  const pins = await nuqFdbMigrationStore.inspectTeamPins(teamId);
  const fdb = getFdb();
  const db = getNuqFdbDatabase();
  await db.doTn(async tn => {
    for (const pin of pins) {
      tn.clear(nuqFdbMigrationStore.objectKey(pin.kind, pin.objectId));
    }
    const range = fdb.tuple.range(["nuq-migration", 1, "team", teamId]);
    tn.clearRange(range.begin as Buffer, range.end as Buffer);
  });
}

async function makeMetricsReady(): Promise<void> {
  for (const queue of [scrapeQueueFdb, crawlFinishedQueueFdb]) {
    await queue.beginMetricCounterBackfill();
    while (!(await queue.backfillMetricCounts(100))) {
      // bounded pages; queues are empty in this focused suite
    }
  }
}

describeIf("NuQ durable migration router", () => {
  beforeAll(async () => {
    config.NUQ_BACKEND = "pg";
    controls.fdbFlag = false;
    controls.pgResidue = 0;
    await Promise.all([
      scrapeQueueFdb.invalidateMetricCounterGeneration(),
      crawlFinishedQueueFdb.invalidateMetricCounterGeneration(),
    ]);
  });

  afterAll(async () => {
    controls.fdbFlag = false;
    controls.pgResidue = 0;
    config.NUQ_BACKEND = previousBackend;
    for (const teamId of teams) await clearTeam(teamId);
  });

  test("freezes authority initialization until both corrected-core counters are ready", async () => {
    const teamId = randomUUID();
    teams.add(teamId);

    await expect(isFdbTeam(teamId)).rejects.toMatchObject({
      code: "NUQ_FDB_CORE_METRICS_NOT_READY",
      retryable: true,
    });
    await expect(nuqFdbMigrationStore.inspectState(teamId)).resolves.toBeNull();

    await makeMetricsReady();
    await expect(isFdbTeam(teamId)).resolves.toBe(false);
    await expect(
      nuqFdbMigrationStore.inspectState(teamId),
    ).resolves.toMatchObject({
      activeBackend: "pg",
      activeGeneration: 1,
      phase: "PG_ONLY",
    });
  });

  test("durable source residue blocks seal until the authoritative ledger drains", async () => {
    const teamId = randomUUID();
    teams.add(teamId);
    controls.fdbFlag = false;
    controls.pgResidue = 1;
    await expect(isFdbTeam(teamId)).resolves.toBe(false);

    controls.fdbFlag = true;
    await expect(isFdbTeam(teamId)).rejects.toMatchObject({
      code: "NUQ_MIGRATION_IN_PROGRESS",
    });
    await expect(isFdbTeam(teamId)).rejects.toMatchObject({
      code: "NUQ_MIGRATION_RESIDUE_NOT_EMPTY",
      retryable: true,
    });
    await expect(
      nuqFdbMigrationStore.inspectState(teamId),
    ).resolves.toMatchObject({
      phase: "DRAINING_TO_FDB",
      activeBackend: "pg",
    });

    controls.pgResidue = 0;
    await expect(isFdbTeam(teamId)).resolves.toBe(true);
    await expect(
      nuqFdbMigrationStore.inspectState(teamId),
    ).resolves.toMatchObject({
      phase: "FDB_ONLY",
      activeBackend: "fdb",
    });
  });

  test("pause/drain seals both directions and a flag flap burns its target generation", async () => {
    const teamId = randomUUID();
    teams.add(teamId);
    controls.fdbFlag = false;
    controls.pgResidue = 0;
    await expect(isFdbTeam(teamId)).resolves.toBe(false);

    controls.fdbFlag = true;
    await expect(isFdbTeam(teamId)).rejects.toMatchObject({
      code: "NUQ_MIGRATION_IN_PROGRESS",
      retryable: true,
    });
    await expect(
      nuqFdbMigrationStore.inspectState(teamId),
    ).resolves.toMatchObject({
      phase: "DRAINING_TO_FDB",
      targetGeneration: 2,
    });

    controls.fdbFlag = false;
    await expect(isFdbTeam(teamId)).resolves.toBe(false);
    await expect(
      nuqFdbMigrationStore.inspectState(teamId),
    ).resolves.toMatchObject({
      phase: "PG_ONLY",
      activeGeneration: 1,
      maxGeneration: 2,
    });

    controls.fdbFlag = true;
    await expect(isFdbTeam(teamId)).rejects.toMatchObject({
      code: "NUQ_MIGRATION_IN_PROGRESS",
    });
    await expect(
      nuqFdbMigrationStore.inspectState(teamId),
    ).resolves.toMatchObject({
      phase: "DRAINING_TO_FDB",
      targetGeneration: 3,
    });
    await expect(isFdbTeam(teamId)).resolves.toBe(true);
    await expect(
      nuqFdbMigrationStore.inspectState(teamId),
    ).resolves.toMatchObject({
      phase: "FDB_ONLY",
      activeGeneration: 3,
      maxGeneration: 3,
    });

    controls.fdbFlag = false;
    await expect(isFdbTeam(teamId)).rejects.toMatchObject({
      code: "NUQ_MIGRATION_IN_PROGRESS",
    });
    await expect(isFdbTeam(teamId)).resolves.toBe(false);
    await expect(
      nuqFdbMigrationStore.inspectState(teamId),
    ).resolves.toMatchObject({
      phase: "PG_ONLY",
      activeGeneration: 4,
      maxGeneration: 4,
    });
  });
});
