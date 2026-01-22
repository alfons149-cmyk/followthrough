import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // 👇 Forceer: geen PostCSS config lookup
  css: {
    postcss: {
      plugins: [],
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
