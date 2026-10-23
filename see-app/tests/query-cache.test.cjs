const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { QueryClient } = require('@tanstack/react-query');
const filename = path.join(__dirname, '../lib/queryCache.ts');
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const exportsForTest = {};
vm.runInNewContext(code, { exports: exportsForTest, require, Date, Set, console, setTimeout, clearTimeout }, { filename });
const { snapshotQueries, restoreQueries, persistAccountQueries, accountCacheKey, CACHE_MAX_AGE } = exportsForTest;
const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
const today = ['account-a', 'dashboard', 'today'];
const dashboard = { items: [], job_count: 0, reminder_count: 0 };

test('cache includes only this account’s list data, never auth or mutation state', () => {
  const client = makeClient();
  client.setQueryData(today, dashboard);
  client.setQueryData(['account-b', 'dashboard', 'today'], { secret: 'other account' });
  client.setQueryData(['account-a', 'notifications'], { token: 'do not cache' });
  client.setQueryData(['account-a', 'jobs', 'private-detail-id'], { content: 'detail' });
  const saved = JSON.parse(snapshotQueries(client, 'account-a'));
  assert.equal(saved.state.queries.length, 1);
  assert.deepEqual(saved.state.queries[0].queryKey, today);
  assert.deepEqual(saved.state.mutations, []);
});

test('first-page snapshots reset pagination and restore without a network response', () => {
  const source = makeClient();
  const key = ['account-a', 'jobs', 'all', 'infinite'];
  source.setQueryData(key, { pages: [[{ id: 'one' }], [{ id: 'two' }]], pageParams: [1, 2] });
  const target = makeClient();
  restoreQueries(target, 'account-a', snapshotQueries(source, 'account-a'));
  assert.deepEqual(JSON.parse(JSON.stringify(target.getQueryData(key))), { pages: [[{ id: 'one' }]], pageParams: [1] });
});

test('expired or cross-account snapshots cannot restore', () => {
  const source = makeClient();
  source.setQueryData(today, dashboard);
  const snapshot = snapshotQueries(source, 'account-a');
  const target = makeClient();
  restoreQueries(target, 'account-b', snapshot);
  assert.equal(target.getQueryData(today), undefined);
  restoreQueries(target, 'account-a', snapshot, Date.now() + CACHE_MAX_AGE + 100);
  assert.equal(target.getQueryData(today), undefined);
});

test('oversized notes do not crowd the dashboard out of the bounded cache', () => {
  const client = makeClient();
  client.setQueryData(today, dashboard);
  client.setQueryData(['account-a', 'notes', 'manual', '', '', 'infinite'], { pages: [[{ content: 'x'.repeat(300_000) }]], pageParams: [1] });
  const saved = JSON.parse(snapshotQueries(client, 'account-a'));
  assert.equal(saved.state.queries.length, 1);
  assert.deepEqual(saved.state.queries[0].queryKey, today);
});

test('slow disk restore cannot replace newer network data', () => {
  const source = makeClient();
  source.setQueryData(today, { value: 'old' }, { updatedAt: Date.now() - 1000 });
  const target = makeClient();
  target.setQueryData(today, { value: 'new' });
  restoreQueries(target, 'account-a', snapshotQueries(source, 'account-a'));
  assert.equal(target.getQueryData(today).value, 'new');
});

test('sign-out during storage restore cannot rehydrate the previous account', async () => {
  const source = makeClient();
  source.setQueryData(today, dashboard);
  let finishRead;
  const removed = [];
  const storage = {
    getItem: () => new Promise(resolve => { finishRead = resolve; }),
    setItem: async () => { throw new Error('must not write after sign-out'); },
    removeItem: async key => removed.push(key)
  };
  const target = makeClient();
  const cache = persistAccountQueries(target, 'account-a', storage);
  await cache.stop(true);
  finishRead(snapshotQueries(source, 'account-a'));
  await cache.restored;
  assert.equal(target.getQueryData(today), undefined);
  assert.deepEqual(removed, [accountCacheKey('account-a')]);
});

test('sign-out clears storage after an in-flight write finishes', async () => {
  let finishWrite;
  const disk = new Map();
  const client = makeClient();
  client.setQueryData(today, dashboard);
  const cache = persistAccountQueries(client, 'account-a', {
    getItem: async () => null,
    setItem: (key, value) => new Promise(resolve => { finishWrite = () => { disk.set(key, value); resolve(); }; }),
    removeItem: async key => disk.delete(key)
  });
  await cache.restored;
  const stopped = cache.stop(true);
  finishWrite();
  await stopped;
  assert.equal(disk.size, 0);
});

test('corrupt storage does not break app startup', async () => {
  const client = makeClient();
  const cache = persistAccountQueries(client, 'account-a', {
    getItem: async () => 'invalid json', setItem: async () => {}, removeItem: async () => {}
  });
  await cache.restored;
  await cache.stop();
  assert.equal(client.getQueryData(today), undefined);
});
