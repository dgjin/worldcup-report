import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";
import path from "path";

const outDir = "dist/client";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "copy-pages-files",
      closeBundle() {
        const src = path.resolve(__dirname, "public");
        const dest = path.resolve(__dirname, outDir);
        for (const f of ["_routes.json", "_redirects"]) {
          const srcPath = path.join(src, f);
          const destPath = path.join(dest, f);
          if (fs.existsSync(srcPath)) fs.copyFileSync(srcPath, destPath);
        }
      },
    },
  ],
  server: { port: 5273 },
  build: {
    outDir,
    emptyOutDir: true,
  },
});
