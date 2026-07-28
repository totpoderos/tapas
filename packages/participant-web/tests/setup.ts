// Bootstraps i18next for participant-web tests exactly as the app does at entry
// (main.tsx `import './i18n'`), so screens rendered directly in a test — not only
// those reached through <App /> — have the global instance and their t() calls
// resolve. Runs after the shared setup (DOM matchers + localStorage polyfill),
// which the language detector relies on.
import '../src/i18n';
