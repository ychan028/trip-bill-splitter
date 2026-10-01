import react from "@vitejs/plugin-react";
import { cpSync, mkdirSync } from "node:fs";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Serve Tesseract (OCR) from our own origin so it can be precached for offline use.
// Only the LSTM cores are needed (OEM 1); the worker picks one by CPU features.
function copyOcrAssets() {
  const out = "public/tesseract";
  mkdirSync(`${out}/core`, { recursive: true });
  mkdirSync(`${out}/lang`, { recursive: true });
  cpSync("node_modules/tesseract.js/dist/worker.min.js", `${out}/worker.min.js`);
  for (const v of ["lstm", "simd-lstm", "relaxedsimd-lstm"]) {
    cpSync(`node_modules/tesseract.js-core/tesseract-core-${v}.wasm.js`, `${out}/core/tesseract-core-${v}.wasm.js`);
  }
  cpSync("node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", `${out}/lang/eng.traineddata.gz`);
}
copyOcrAssets();

export default defineConfig({
  // Relative base so the build works at any GitHub Pages path (repo name can change).
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "icon-180.png"],
      manifest: {
        name: "Trip Splitter",
        short_name: "Splitter",
        description: "Shared trip expenses, offline, multi-currency",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#1f6f5c",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,wasm,traineddata,gz}"],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
      },
    }),
  ],
  test: {
    include: ["src/**/*.test.ts"],
  },
});
