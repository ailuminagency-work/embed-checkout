// Shared email sender for all edge functions.
// Priority: SMTP (Gmail/Outlook App Password — EMAIL_* secrets) → Resend (RESEND_API_KEY).
// Neither configured → { ok: false } with an actionable error, never throws.

export interface SendResult {
  ok: boolean;
  provider?: "smtp" | "resend";
  error?: string;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<SendResult> {
  const smtpHost = Deno.env.get("EMAIL_HOST");
  const smtpUser = Deno.env.get("EMAIL_USER");
  const smtpPassword = Deno.env.get("EMAIL_PASSWORD");
  const fromName = Deno.env.get("EMAIL_FROM_NAME") ?? "Bookings";

  // ── 1. SMTP (Gmail / Outlook / any provider) ───────────────────────────────
  if (smtpHost && smtpUser && smtpPassword) {
    try {
      const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
      const port = parseInt(Deno.env.get("EMAIL_PORT") ?? "587", 10);
      const client = new SMTPClient({
        connection: {
          hostname: smtpHost,
          port,
          tls: port === 465, // 465 = implicit TLS, 587 = STARTTLS
          auth: { username: smtpUser, password: smtpPassword },
        },
      });
      await client.send({
        from: `${fromName} <${smtpUser}>`,
        to,
        subject,
        html,
      });
      await client.close();
      return { ok: true, provider: "smtp" };
    } catch (err) {
      console.error("[email] SMTP send failed, trying fallback:", String(err));
      // fall through to Resend if available
    }
  }

  // ── 2. Resend fallback ──────────────────────────────────────────────────────
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    const fromEmail = Deno.env.get("FROM_EMAIL") ?? "bookings@resend.dev";
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to, subject, html }),
      });
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, provider: "resend", error: `Resend ${res.status}: ${text}` };
      }
      return { ok: true, provider: "resend" };
    } catch (e) {
      return { ok: false, provider: "resend", error: String(e) };
    }
  }

  return {
    ok: false,
    error:
      "No email provider configured — add EMAIL_HOST/EMAIL_USER/EMAIL_PASSWORD (Gmail/Outlook App Password) or RESEND_API_KEY to Supabase Edge Function secrets",
  };
}
