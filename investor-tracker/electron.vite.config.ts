import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const sharedAlias = {
  "@shared": resolve(__dirname, "src/shared"),
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias },
    build: {
      outDir: "dist/main",
      lib: { entry: resolve(__dirname, "src/main/index.ts") },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias },
    build: {
      outDir: "dist/preload",
      lib: { entry: resolve(__dirname, "src/main/preload.ts") },
    },
  },
  renderer: {
    plugins: [react()],
    resolve: { alias: sharedAlias },
    root: resolve(__dirname, "src/renderer"),
    build: {
      outDir: resolve(__dirname, "dist/renderer"),
      rollupOptions: {
        input: resolve(__dirname, "src/renderer/index.html"),
      },
    },
  },
});
