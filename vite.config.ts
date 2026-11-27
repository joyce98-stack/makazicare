import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: projectRoot,
  publicDir: path.resolve(projectRoot, "frontend"),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src"),
    },
  },
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (proxyRequest) => proxyRequest.removeHeader("origin"));
        },
      },
      "/hooks": {
        target: "http://localhost:3001",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (proxyRequest) => proxyRequest.removeHeader("origin"));
        },
      },
    },
  },
  build: {
    outDir: path.resolve(projectRoot, "dist"),
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        landing: path.resolve(projectRoot, "index.html"),
        signin: path.resolve(projectRoot, "signin.html"),
      },
    },
  },
});
