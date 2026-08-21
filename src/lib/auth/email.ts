import { Resend } from "resend";

export async function sendMagicLinkEmail(opts: { to: string; url: string }) {
  const from = process.env.RESEND_FROM_EMAIL ?? "Ridgeline <hello@ridgeline.highaltitude.solutions>";
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not configured");
    }
    console.info(`[ridgeline] Magic link for ${opts.to}: ${opts.url}`);
    return;
  }

  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: "Sign in to Ridgeline",
    text: `Sign in to Ridgeline\n\n${opts.url}\n\nThis link expires in 15 minutes.`,
    html: `<p>Sign in to Ridgeline to keep your library across devices.</p>
<p><a href="${opts.url}">Continue</a></p>
<p style="color:#9AA8B5;font-size:12px">This link expires in 15 minutes. If you didn’t request it, you can ignore this email.</p>`,
  });
  if (error) throw new Error(error.message);
}
