import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Port 8000 falls inside a Windows excluded port range on some machines, so the
// backend port is configurable. Override with API_PORT when running the API elsewhere.
const apiPort = process.env.API_PORT || "8010";

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", proxy: { "/api": `http://127.0.0.1:${apiPort}` } },
});
