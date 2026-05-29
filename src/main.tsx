import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const REQUIRED = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"] as const;
const missing = REQUIRED.filter((k) => !import.meta.env[k]);

if (missing.length > 0) {
  document.body.innerHTML = `
    <div style="font-family:monospace;padding:2rem;max-width:600px;margin:4rem auto">
      <h2 style="color:#dc2626">Configuration Error</h2>
      <p>The following required environment variables are missing:</p>
      <ul>${missing.map((k) => `<li><strong>${k}</strong></li>`).join("")}</ul>
      <p style="color:#6b7280">Add them to your <code>.env</code> file and restart the dev server.</p>
    </div>`;
  throw new Error(`Missing env vars: ${missing.join(", ")}`);
}

createRoot(document.getElementById("root")!).render(<App />);
