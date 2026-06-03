import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const isWidget = process.env.BUILD_TARGET === "widget";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: { overlay: false },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    ...(isWidget && {
      build: {
        lib: {
          entry: path.resolve(__dirname, "src/embed.tsx"),
          name: "BookingWidget",
          fileName: "widget",
          formats: ["iife"],
        },
        rollupOptions: {
          output: { inlineDynamicImports: true },
        },
      },
    }),
  };
});
