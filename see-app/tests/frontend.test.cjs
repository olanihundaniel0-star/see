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
const datetime = load('lib/datetime.ts');
const format = load('lib/format.ts', { './datetime': datetime });

test('date-only values retain the selected day in positive and negative UTC offsets', () => {
  const original = process.env.TZ;
  try {
    for (const timezone of ['Africa/Lagos', 'America/Los_Angeles', 'Pacific/Auckland']) {
      process.env.TZ = timezone;
      const date = datetime.pickerDate('2026-10-22', 'date');
      assert.equal(date.getDate(), 22, timezone);
      assert.equal(datetime.pickerValue(date, 'date'), '2026-10-22', timezone);
      assert.match(format.formatShortDate('2026-10-22'), /22 Oct/, timezone);
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});

test('local datetime selection round-trips through UTC across DST offsets', () => {
  const original = process.env.TZ;
  try {
    for (const [timezone, local, utc] of [
      ['Africa/Lagos', '2026-10-22T09:30', '2026-10-22T08:30:00.000Z'],
      ['America/New_York', '2026-01-22T09:30', '2026-01-22T14:30:00.000Z'],
      ['America/New_York', '2026-07-22T09:30', '2026-07-22T13:30:00.000Z']
    ]) {
      process.env.TZ = timezone;
      assert.equal(datetime.parseDateTimeInput(local), utc);
      assert.equal(datetime.toDateTimeInput(utc), local);
      assert.match(format.formatFullDateTime(utc), /09:30/);
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});

test('invalid dates are rejected; clearing optional timestamps serializes as null', () => {
  assert.equal(datetime.pickerDate('2026-02-30', 'date'), null);
  assert.equal(datetime.pickerDate('25:00', 'time'), null);
  assert.equal(datetime.pickerDate('not a date', 'datetime'), null);
  assert.equal(datetime.parseDateTimeInput(''), null);
  assert.throws(() => datetime.parseDateTimeInput('not a date'));
});

test('time-only notification preferences use integer hours and preserve midnight', () => {
  for (const time of ['00:00', '08:30', '23:59']) {
    const date = datetime.pickerDate(time, 'time');
    assert.equal(datetime.pickerValue(date, 'time'), time);
    assert.equal(datetime.pickerValue(date, 'time', true), time.slice(0, 2) + ':00');
  }
});

test('overdue dates cannot appear as LIVE or upcoming', () => {
  assert.equal(format.formatCountdown(new Date(Date.now() - 60_000)), 'Overdue');
  assert.match(format.formatCountdown(new Date(Date.now() + 3_600_000)), /^In /);
  assert.equal(format.formatCountdown('invalid'), 'Date unavailable');
});

function notificationHarness() {
  const calls = { cancelled: [], scheduled: [], claims: [] };
  const state = { pending: [], existing: [], granted: true };
  const notifications = load('lib/notifications.ts', {
    'expo-notifications': {
      setNotificationHandler() {},
      getPermissionsAsync: async () => ({ granted: state.granted }),
      getAllScheduledNotificationsAsync: async () => state.existing,
      cancelScheduledNotificationAsync: async id => calls.cancelled.push(id),
      scheduleNotificationAsync: async value => { calls.scheduled.push(value); return value.identifier; },
      SchedulableTriggerInputTypes: { DATE: 'date' }
    },
    'expo-secure-store': { getItemAsync: async () => 'device-a' },
    'react-native': { Platform: { OS: 'android' } },
    'expo-constants': { default: {} },
    '@/lib/api': { api: {
      get: async () => ({ data: state.pending }),
      post: async (...args) => { calls.claims.push(args); return { data: {} }; }
    } }
  });
  return { ...notifications, state, calls };
}

test('rescheduling cancels obsolete alerts and schedules replacement UTC dates', async () => {
  const h = notificationHarness();
  h.setNotificationUser('user-a');
  h.state.existing = [{ identifier: 'old-date', content: { data: { user_id: 'user-a' } } }];
  const nextDate = new Date(Date.now() + 3_600_000).toISOString();
  h.state.pending = [{ id: 'new-date', send_at: nextDate, body: 'Interview', route: '/jobs/123', source: 'job_interview_at' }];
  await h.syncLocalNotifications('user-a');
  assert.deepEqual(h.calls.cancelled, ['old-date']);
  assert.equal(h.calls.scheduled.length, 1);
  assert.equal(h.calls.scheduled[0].trigger.date.toISOString(), nextDate);
  assert.equal(h.calls.scheduled[0].content.data.user_id, 'user-a');
  assert.equal(h.calls.claims[0][0], '/notifications/new-date/local');
});

test('completion/deletion cancels alerts; existing active alerts are not duplicated', async () => {
  const h = notificationHarness();
  h.setNotificationUser('user-a');
  h.state.existing = [{ identifier: 'completed', content: { data: { user_id: 'user-a' } } }, { identifier: 'active', content: { data: { user_id: 'user-a' } } }];
  h.state.pending = [{ id: 'active', send_at: new Date(Date.now() + 3_600_000).toISOString() }];
  await h.syncLocalNotifications('user-a');
  assert.deepEqual(h.calls.cancelled, ['completed']);
  assert.equal(h.calls.scheduled.length, 0);
});

test('notification syncing and navigation stay isolated to the current user', async () => {
  const h = notificationHarness();
  h.setNotificationUser('user-b');
  await h.syncLocalNotifications('user-a');
  assert.equal(h.calls.scheduled.length, 0);
  assert.equal(h.notificationRoute({ user_id: 'user-a', route: '/(tabs)/events' }, 'user-b'), null);
  assert.equal(h.notificationRoute({ user_id: 'user-b', route: '/(tabs)/events' }, 'user-b'), '/(tabs)/events');
});
