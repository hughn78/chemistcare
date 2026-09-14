import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      // Realistic baseline: the clinical engine is the part that must be
      // covered; page components and vendored UI are not yet.
      include: ["src/clinical/**", "src/lib/**", "src/hooks/**"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test/**"],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
