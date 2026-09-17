// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
  },
  {
    // This app intentionally mirrors query/server data into local editable form
    // state inside effects (note/reminder/job detail screens, root layout).
    // Converting every case to derived state would restructure many screens and
    // change established form behavior, so this one rule is turned off.
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['lib/api.ts'],
    rules: {
      // `axios.create(...)` is the documented axios usage; flagging default
      // import member access here would be noise rather than a real issue.
      'import/no-named-as-default-member': 'off',
    },
  },
]);
