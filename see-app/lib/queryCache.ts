import { dehydrate, hydrate, type DehydratedState, type QueryClient, type QueryKey } from "@tanstack/react-query";

export const CACHE_MAX_AGE = 24 * 60 * 60_000;
const CACHE_MAX_SIZE = 256_000;
const resources = new Set(["jobs", "notes", "events", "reminders"]);
export type CacheStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
  removeItem(key: string): Promise<unknown>;
};

export function accountCacheKey(account: string) { return `see-query-cache-v1-${account}`; }

function cacheable(key: QueryKey, account: string) {
  return key[0] === account && (
    (key.length === 3 && key[1] === "dashboard" && key[2] === "today") ||
    (resources.has(String(key[1])) && key[key.length - 1] === "infinite")
  );
}

/** Keep list previews, never auth tokens, notification credentials or queued writes. */
export function snapshotQueries(client: QueryClient, account: string, now = Date.now()) {
  const state = dehydrate(client, {
    shouldDehydrateMutation: () => false,
    shouldDehydrateQuery: query => cacheable(query.queryKey, account) && query.state.data !== undefined
      && query.state.dataUpdatedAt > now - CACHE_MAX_AGE
  });
  state.queries = state.queries.sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt).slice(0, 12).map(query => {
    const data = query.state.data as { pages?: unknown[]; pageParams?: unknown[] };
    return { ...query, state: { ...query.state, status: "success", error: null, fetchStatus: "idle",
      data: Array.isArray(data?.pages) ? { ...data, pages: data.pages.slice(0, 1), pageParams: data.pageParams?.slice(0, 1) ?? [1] } : data
    } };
  });
  // One oversized notebook must not crowd out the small Today snapshot.
  const candidates = state.queries;
  state.queries = [];
  let serialized = JSON.stringify({ version: 1, account, savedAt: now, state });
  for (const query of candidates) {
    state.queries.push(query);
    const next = JSON.stringify({ version: 1, account, savedAt: now, state });
    if (next.length <= CACHE_MAX_SIZE) serialized = next;
    else state.queries.pop();
  }
  return serialized;
}

export function restoreQueries(client: QueryClient, account: string, serialized: string, now = Date.now()) {
  if (serialized.length > CACHE_MAX_SIZE) return;
  const saved = JSON.parse(serialized) as { version: number; account: string; savedAt: number; state: DehydratedState };
  if (saved.version !== 1 || saved.account !== account || !Number.isFinite(saved.savedAt)
    || saved.savedAt > now || now - saved.savedAt > CACHE_MAX_AGE || !Array.isArray(saved.state?.queries)) return;
  const queries = saved.state.queries.filter(query => Array.isArray(query.queryKey)
    && cacheable(query.queryKey, account) && query.state?.dataUpdatedAt > now - CACHE_MAX_AGE);
  hydrate(client, { mutations: [], queries });
}

export function persistAccountQueries(client: QueryClient, account: string, storage: CacheStorage) {
  let active = true;
  let restoring = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writes = Promise.resolve();
  const key = accountCacheKey(account);
  const save = () => {
    if (!active || restoring) return;
    const value = snapshotQueries(client, account);
    writes = writes.then(async () => { await storage.setItem(key, value); }).catch(() => undefined);
  };
  const unsubscribe = client.getQueryCache().subscribe(event => {
    if (event.type !== "updated" || event.action.type !== "success" || !cacheable(event.query.queryKey, account)) return;
    clearTimeout(timer);
    timer = setTimeout(save, 500);
  });
  const restored = storage.getItem(key).then(value => {
    if (active && value) restoreQueries(client, account, value);
  }).catch(() => undefined).finally(() => { restoring = false; if (active) save(); });
  return {
    restored,
    async stop(clear = false) {
      clearTimeout(timer);
      unsubscribe();
      // Capture the last successful changes on a normal unmount, but never save
      // after an account switch. A pending write finishes before sign-out clears it.
      if (!clear) save();
      active = false;
      await writes;
      if (clear) await storage.removeItem(key).catch(() => undefined);
    }
  };
}
