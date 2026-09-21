import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/unit/**/*.spec.js"],
    setupFiles: ["test/unit/setup.js"],
  },
});
