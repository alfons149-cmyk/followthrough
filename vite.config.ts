import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [], // force: no postcss config lookup
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "https://followthrough.pages.dev",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
