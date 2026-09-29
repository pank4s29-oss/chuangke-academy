import path from "node:path";
import { defineConfig } from "vitest/config";

// Mirrors tsconfig.json's "@/*" -> "./src/*" path alias so files under
// src/components (which import via "@/lib/...") can be unit-tested with
// vitest directly, the same way files under src/lib already are.
export default defineConfig({
  // tsconfig uses "jsx": "preserve" (Next compiles it); tell vitest to use the automatic runtime so component tests can render.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
