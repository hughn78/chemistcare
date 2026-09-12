import "@testing-library/jest-dom";

/**
 * Guarded: some clinical test files intentionally run in the `node`
 * environment (they exercise pure clinical logic and need no DOM). Previously
 * this file touched `window` unconditionally and those suites crashed with
 * "ReferenceError: window is not defined", which made `npm test` fail.
 */
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
