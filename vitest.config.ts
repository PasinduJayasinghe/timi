import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // A zone with daylight saving, so date tests cover 23- and 25-hour days
    env: { TZ: "Europe/London" },
    // The contrast test reads the design tokens as text (tokens.css?raw)
    css: { include: [/tokens\.css/] },
  },
});
