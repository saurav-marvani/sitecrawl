export type NuQPgPublicationPlacement = "active" | "backlog";

export type NuQPgPublication = {
  id: string;
  ownerId: string;
  groupId?: string;
  placement: NuQPgPublicationPlacement;
};

export type NuQPgPublicationOutcome = "published" | "compensated";

/**
 * Boundary for the durable generation intent which must surround PG + Redis
 * publication during the queue migration. The router integration will replace
 * this no-op adapter with generation-aware prepare/complete operations. Keep
 * this module PG-only: it must remain importable without native FDB bindings.
 */
export interface NuQPgPublicationAdapter {
  prepare(publications: readonly NuQPgPublication[]): Promise<void>;
  complete(
    publications: readonly NuQPgPublication[],
    outcome: NuQPgPublicationOutcome,
  ): Promise<void>;
}

const noOpAdapter: NuQPgPublicationAdapter = {
  async prepare() {},
  async complete() {},
};

let adapter: NuQPgPublicationAdapter = noOpAdapter;

export type PreparedNuQPgPublication = {
  publications: readonly NuQPgPublication[];
  adapter: NuQPgPublicationAdapter;
};

export function setNuQPgPublicationAdapter(
  next: NuQPgPublicationAdapter | null,
): void {
  adapter = next ?? noOpAdapter;
}

export async function prepareNuQPgPublication(
  publications: readonly NuQPgPublication[],
): Promise<PreparedNuQPgPublication> {
  const prepared = { publications, adapter };
  if (publications.length > 0) await prepared.adapter.prepare(publications);
  return prepared;
}

export async function completePreparedNuQPgPublication(
  prepared: PreparedNuQPgPublication,
  outcome: NuQPgPublicationOutcome = "published",
): Promise<void> {
  if (prepared.publications.length > 0) {
    await prepared.adapter.complete(prepared.publications, outcome);
  }
}

export async function completeNuQPgPublication(
  publications: readonly NuQPgPublication[],
  outcome: NuQPgPublicationOutcome = "published",
): Promise<void> {
  if (publications.length > 0) await adapter.complete(publications, outcome);
}
