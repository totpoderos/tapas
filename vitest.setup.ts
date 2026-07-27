import '@testing-library/jest-dom/vitest';

// Node 24 injects an experimental global `localStorage` that only stores when
// started with `--localstorage-file <path>`; without one it's an empty,
// method-less object that shadows jsdom's. Tests that persist to localStorage
// (e.g. the host's theme choice) need a working one, so install a simple
// in-memory Storage whenever the ambient one can't actually store. Node's
// sessionStorage is already in-memory and unaffected.
if (typeof globalThis.localStorage?.setItem !== 'function') {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(String(key), String(value)),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  }
}
