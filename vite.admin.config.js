import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Admin dashboard build. Output goes to dist-admin/ and is served by the FastAPI
// backend at /admin — it is never uploaded to the customer host.
//
// `base` is /admin/ so the generated asset URLs resolve under the backend's
// /admin mount rather than at the domain root.
const apiPort = process.env.API_PORT || "8010";

export default defineConfig({
  plugins: [react()],
  base: "/admin/",
  build: {
    outDir: "dist-admin",
    emptyOutDir: true,
    rollupOptions: { input: "admin.html" },
  },
  server: { host: "127.0.0.1", port: 5175, proxy: { "/api": `http://127.0.0.1:${apiPort}` } },
});
