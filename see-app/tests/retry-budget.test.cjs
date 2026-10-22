const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
  const filename = path.join(__dirname, '..', file);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => name in imports ? imports[name] : require(name), Date, Intl, Set, console }, { filename });
  return exports;
}
const axios = { isCancel: e => e && e.name === 'Canceled', isAxiosError: e => e && e.__isAxios };
const { coldStartRetry, coldStartRetryDelay } = load('lib/queryPolicy.ts', { axios });

test('cold-start budget allows five attempts with exponential capped delays', () => {
  const timeout = { code: 'ECONNABORTED', response: undefined, __isAxios: true };
  // count < 4 while transient: counts 0-3 authorize attempts one through five.
  assert.equal(coldStartRetry(0, timeout), true);
  assert.equal(coldStartRetry(1, timeout), true);
  assert.equal(coldStartRetry(2, timeout), true);
  assert.equal(coldStartRetry(3, timeout), true);
  assert.equal(coldStartRetry(4, timeout), false);
  assert.deepEqual([0, 1, 2, 3].map(coldStartRetryDelay), [1500, 3000, 5000, 5000]);
  // Five attempts against the 10s client timeout plus 14.5s of delays must
  // cover a worst-case 55s Render cold start.
  const budget = 5 * 10_000 + [1500, 3000, 5000, 5000].reduce((a, b) => a + b, 0);
  assert.ok(budget >= 60_000);
});

test('permanent 4xx responses never retry', () => {
  for (const status of [400, 401, 404, 500]) {
    assert.equal(coldStartRetry(0, { response: { status }, __isAxios: true }), false, String(status));
  }
});

test('server 502/503/504 and no-response errors are transient (retryable)', () => {
  for (const status of [502, 503, 504]) {
    assert.equal(coldStartRetry(0, { response: { status }, __isAxios: true }), true, String(status));
  }
  assert.equal(coldStartRetry(0, { response: undefined, __isAxios: true }), true);
});

test('cancellations never retry', () => {
  assert.equal(coldStartRetry(0, { name: 'Canceled', __isAxios: true }), false);
});

test('transientRetry removed now the client default owns the budget', () => {
  const transientRetryExport = load('lib/queryPolicy.ts', { axios });
  assert.equal(typeof transientRetryExport.transientRetry, 'undefined');
});
