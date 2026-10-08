import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative assets support GitHub Pages' /web-darts-game/ path and other static hosts.
  base: "./",
});
