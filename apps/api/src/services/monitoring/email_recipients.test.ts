type QueryResult = { data: unknown; error: unknown };

const fromMock = jest.fn();
const selectMock = jest.fn();
const insertMock = jest.fn();
const eqMonitorMock = jest.fn();
const eqEmailMock = jest.fn();
const maybeSingleSelectMock = jest.fn();
const maybeSingleInsertMock = jest.fn();
const insertSelectMock = jest.fn();

function configureSupabaseMocks(opts: {
  selectMaybeSingle: () => Promise<QueryResult>;
  insertMaybeSingle?: () => Promise<QueryResult>;
}) {
  maybeSingleSelectMock.mockImplementation(opts.selectMaybeSingle);
  maybeSingleInsertMock.mockImplementation(
    opts.insertMaybeSingle ?? (() => Promise.resolve({ data: null, error: null })),
  );
  eqEmailMock.mockReturnValue({ maybeSingle: maybeSingleSelectMock });
  eqMonitorMock.mockReturnValue({ eq: eqEmailMock });
  insertSelectMock.mockReturnValue({ maybeSingle: maybeSingleInsertMock });
  selectMock.mockReturnValue({ eq: eqMonitorMock });
  insertMock.mockReturnValue({ select: insertSelectMock });
  fromMock.mockReturnValue({
    select: selectMock,
    insert: insertMock,
  });
}

jest.mock("../supabase", () => ({
  supabase_service: {
    from: (...args: unknown[]) => fromMock(...args),
  },
  supabase_rr_service: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { ensureMonitorEmailRecipient } from "./email_recipients";

beforeEach(() => {
  fromMock.mockReset();
  selectMock.mockReset();
  insertMock.mockReset();
  eqMonitorMock.mockReset();
  eqEmailMock.mockReset();
  maybeSingleSelectMock.mockReset();
  maybeSingleInsertMock.mockReset();
  insertSelectMock.mockReset();
});

const baseInput = {
  monitorId: "monitor-1",
  teamId: "team-1",
  input: {
    email: "alerts@example.com",
    source: "opt_in" as const,
    status: "pending" as const,
  },
};

function recipientRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec-1",
    monitor_id: "monitor-1",
    team_id: "team-1",
    email: "alerts@example.com",
    status: "pending",
    token: "tok-1",
    source: "opt_in",
    confirmation_sent_at: null,
    confirmed_at: null,
    unsubscribed_at: null,
    last_notified_at: null,
    created_at: "now",
    updated_at: "now",
    ...overrides,
  };
}

describe("ensureMonitorEmailRecipient", () => {
  it("returns existing row when the recipient already exists (no insert)", async () => {
    const existing = recipientRow({ status: "confirmed", source: "team" });
    configureSupabaseMocks({
      selectMaybeSingle: () => Promise.resolve({ data: existing, error: null }),
    });

    const result = await ensureMonitorEmailRecipient(baseInput);

    expect(result).toEqual({ row: existing, created: false });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("inserts and returns created=true when no row exists", async () => {
    const inserted = recipientRow();
    configureSupabaseMocks({
      selectMaybeSingle: () => Promise.resolve({ data: null, error: null }),
      insertMaybeSingle: () => Promise.resolve({ data: inserted, error: null }),
    });

    const result = await ensureMonitorEmailRecipient(baseInput);

    expect(result).toEqual({ row: inserted, created: true });
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("treats a concurrent-insert unique violation as not-created (no throw)", async () => {
    // Concurrent sync wrote the row between our SELECT and INSERT.
    const winnerRow = recipientRow({ id: "rec-winner" });
    let selectCalls = 0;
    configureSupabaseMocks({
      selectMaybeSingle: () => {
        selectCalls += 1;
        if (selectCalls === 1) return Promise.resolve({ data: null, error: null });
        return Promise.resolve({ data: winnerRow, error: null });
      },
      insertMaybeSingle: () =>
        Promise.resolve({
          data: null,
          error: { code: "23505", message: "duplicate key" },
        }),
    });

    const result = await ensureMonitorEmailRecipient(baseInput);

    expect(result).toEqual({ row: winnerRow, created: false });
    expect(selectCalls).toBe(2);
  });

  it("rethrows non-unique insert errors", async () => {
    configureSupabaseMocks({
      selectMaybeSingle: () => Promise.resolve({ data: null, error: null }),
      insertMaybeSingle: () =>
        Promise.resolve({
          data: null,
          error: { code: "42501", message: "permission denied" },
        }),
    });

    await expect(ensureMonitorEmailRecipient(baseInput)).rejects.toThrow(
      /permission denied/,
    );
  });

  it("rethrows unique violations when no winning row can be re-fetched", async () => {
    // Defensive: if the unique violation is on `token` (not the recipient
    // pair) the re-fetch returns nothing and we should surface the error
    // instead of silently lying about creation.
    configureSupabaseMocks({
      selectMaybeSingle: () => Promise.resolve({ data: null, error: null }),
      insertMaybeSingle: () =>
        Promise.resolve({
          data: null,
          error: { code: "23505", message: "duplicate key" },
        }),
    });

    await expect(ensureMonitorEmailRecipient(baseInput)).rejects.toThrow(
      /duplicate key/,
    );
  });
});
