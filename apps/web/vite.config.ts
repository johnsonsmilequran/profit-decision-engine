import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { extensions: [".ts", ".tsx", ".mjs", ".js", ".mts", ".jsx", ".json"] },
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
