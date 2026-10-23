// Render the actual screen components against deterministic data. Native modules
// and navigation are mocked; this is a render smoke test, not a device test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToString } = require('react-dom/server');
const native = require('react-native-web');
const root = path.join(__dirname, '..');
const timestamp = '2026-12-01T10:00:00Z';
const job = { id: 'job-1', company: 'Example Systems', role: 'Backend Engineer', location: 'Remote', salary_range: null, job_url: 'https://example.com', status: 'interviewing', interview_notes: '', deadline: timestamp, interview_at: timestamp, assessment_at: null, follow_up_at: null, applied_at: timestamp, updated_at: timestamp, checklists: [{ id: 'task-1', title: 'Prepare examples', is_completed: false }] };
const note = { id: 'note-1', title: 'Interview prep', content: 'Review concurrency and transactions.', tags: 'systems,interviews', updated_at: timestamp };
const reminder = { id: 'reminder-1', title: 'Send follow-up', due_date: timestamp, priority: 'high', is_completed: false, created_at: timestamp };
const event = { id: 'event-1', source: 'Example source', title: 'Developer meetup', description: 'A meetup for developers.', is_virtual: true, location: null, url: 'https://example.com', start_date: timestamp, end_date: null, categories: ['Meetup'] };
let scenario = 'loaded';
let mode = 'job';
const mutation = () => ({ isPending: false, mutate() {}, mutateAsync: async () => ({}) });
const query = data => ({ data: ['loaded', 'stale-error'].includes(scenario) ? data : undefined, isLoading: scenario === 'loading', isPending: scenario === 'loading', isRefetching: false, error: ['error', 'stale-error'].includes(scenario) ? new Error('Offline') : null, refetch: async () => {}, fetchNextPage: async () => {}, hasNextPage: false, isFetchingNextPage: false });
const queryMocks = {
  useToday: () => query({ window_hours: 48, items: [{ kind: 'job', id: job.id, title: job.role, due_at: timestamp, status: 'interviewing' }, { kind: 'reminder', id: reminder.id, title: reminder.title, due_at: timestamp, priority: 'high' }] }),
  useInfiniteJobs: () => query({ pages: [scenario === 'empty' ? [] : [job]] }),
  useInfiniteNotes: () => query({ pages: [[note]] }),
  useInfiniteReminders: () => query({ pages: [[reminder]] }),
  useInfiniteEvents: () => query({ pages: [{ items: [event] }] }),
  useJob: () => query(job), useNote: () => query(note), useReminder: () => query(reminder),
  ...Object.fromEntries(['useUpdateReminder', 'useUpdateJob', 'useDeleteJob', 'useToggleChecklist', 'useCreateChecklist', 'useUpdateNote', 'useDeleteNote', 'useDeleteReminder', 'useQuickAdd'].map(name => [name, mutation]))
};
const router = { push() {}, replace() {}, back() {}, canGoBack: () => true };
const Stack = Object.assign(() => null, { Screen: () => null });
const mocks = {
  'react-native': native,
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }) },
  'expo-router': { router, Stack, useLocalSearchParams: () => ({ id: 'fixture', mode }), useNavigation: () => ({ dispatch() {} }) },
  'expo-router/react-navigation': { usePreventRemove() {} },
  '@expo/vector-icons/Feather': { __esModule: true, default: () => null },
  '@react-native-community/datetimepicker': { __esModule: true, default: () => null, DateTimePickerAndroid: { open() {} } },
  '@tanstack/react-query': { useMutation: mutation, useQuery: () => query([]) },
  'expo-calendar': {}, 'expo-haptics': {},
  'expo-web-browser': { maybeCompleteAuthSession() {} },
  '@/lib/queries': queryMocks,
  '@/lib/notifications': {},
  '@/lib/api': { api: {} },
  '@/lib/supabase': { supabase: null }
};
const cache = new Map();
function load(file) {
  const filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  const localRequire = name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/') || name.startsWith('.')) {
      const target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
      const resolved = [target, target + '.ts', target + '.tsx'].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (resolved) return load(resolved);
    }
    return require(name);
  };
  vm.runInNewContext(code, { exports, require: localRequire, Date, Intl, Set, console, setTimeout, clearTimeout, setInterval, clearInterval, __DEV__: false }, { filename });
  cache.set(filename, exports);
  return exports;
}
const routes = ['(tabs)/index', '(tabs)/jobs', '(tabs)/events', '(tabs)/notes', '(tabs)/reminders', '(tabs)/account', 'jobs/[id]', 'notes/[id]', 'reminders/[id]', '+not-found', 'auth'];
for (const state of ['loaded', 'loading', 'error', 'empty', 'stale-error']) {
  for (const route of routes) {
    test(`${route} renders in ${state} state`, () => {
      scenario = state;
      const Component = load(`app/${route}.tsx`).default;
      const html = renderToString(React.createElement(Component));
      assert.ok(html.length > 100);
      assert.doesNotMatch(html, /SYS_ONLINE|SYNC_EPOCH|PIPELINE_METRICS/);
      if (state === 'stale-error' && ['(tabs)/index', '(tabs)/jobs', '(tabs)/events', '(tabs)/notes', '(tabs)/reminders'].includes(route)) {
        assert.match(html, /Showing your last saved data/);
        assert.match(html, /Backend Engineer|Developer meetup|Interview prep|Send follow-up/);
      }
      if (route.startsWith('(tabs)/') && route !== '(tabs)/account') assert.match(html, /aria-label="Add"/);
    });
  }
}
for (const selectedMode of ['job', 'note', 'reminder']) {
  test(`Quick Add renders ${selectedMode} fields and primary action`, () => {
    scenario = 'loaded'; mode = selectedMode;
    const Component = load('app/modal/quick-add.tsx').default;
    const html = renderToString(React.createElement(Component));
    assert.match(html, new RegExp(selectedMode === 'job' ? 'Add application' : selectedMode === 'note' ? 'Save note' : 'Create reminder'));
    if (selectedMode !== 'note') assert.match(html, /datetime-local/);
  });
}
