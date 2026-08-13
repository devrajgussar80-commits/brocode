import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Customer application build (deployed to Vercel).
//
// `input` is pinned to index.html on purpose: it keeps admin.html — and therefore
// the whole admin bundle — out of dist/, so the public deployment cannot serve the
// admin dashboard even by direct URL. The admin build is a separate config.
//
// Port 8000 sits inside a Windows excluded port range on some machines, so the
// dev proxy target is configurable via API_PORT.
const apiPort = process.env.API_PORT || "8010";

// Landing URL the bare domain redirects to. Mirrors the `redirects` rule in
// vercel.json so local dev and production behave identically.
const LANDING = process.env.DEFAULT_LANDING_PATH || "/welcome?user=brocode&id=1985634";

/**
 * Reproduces the two Vercel routing rules on the dev server:
 *   1. `/` redirects to the landing URL.
 *   2. `/admin` is not served here at all — the admin dashboard lives on the
 *      backend only. Without this the SPA fallback would hand back the customer
 *      app for /admin, which looks like the route exists when it does not.
 */
function customerRouting() {
  return {
    name: "brocode-customer-routing",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const [path] = (req.url || "/").split("?");
        if (path === "/admin" || path.startsWith("/admin/")) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("Not found. The admin dashboard is served by the backend, not the customer app.");
          return;
        }
        if (path === "/" && LANDING) {
          res.statusCode = 302;
          res.setHeader("Location", LANDING);
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), customerRouting()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: { input: "index.html" },
  },
  server: { host: "127.0.0.1", proxy: { "/api": `http://127.0.0.1:${apiPort}` } },
});
