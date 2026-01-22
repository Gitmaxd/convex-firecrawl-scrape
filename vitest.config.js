import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
    // Ignore unhandled rejections from convex-test scheduled function cleanup.
    // These occur when fake timers cause scheduled functions to run after
    // the test context has been disposed, triggering "Write outside of transaction".
    // This is a known limitation of convex-test with fake timers - the scheduled
    // functions run asynchronously and can outlive the test context.
    dangerouslyIgnoreUnhandledErrors: true,
  },
});
