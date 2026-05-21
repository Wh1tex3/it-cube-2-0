import { defineConfig } from "vite";
import { cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "copy-projectlego-assets",
      closeBundle() {
        const source = resolve(rootDir, "Projectlego");
        const destination = resolve(rootDir, "dist", "Projectlego");

        if (existsSync(source)) {
          cpSync(source, destination, { recursive: true });
        }
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
});
