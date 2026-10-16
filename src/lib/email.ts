import { getAppUrl } from "./share";

/** Welcome email with the license key. Throws when Resend is unconfigured. */
export async function sendLicenseEmail(
  to: string,
  licenseKey: string,
  tier: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    throw new Error("Email is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).");
  }
  const unlockUrl = `${getAppUrl()}/unlock`;
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: "Your Crypto Drive license key",
    html:
      `<p>Thanks for purchasing Crypto Drive (${tier}). Your license key is:</p>` +
      `<pre style="font-size:18px;font-weight:bold">${licenseKey}</pre>` +
      `<p>Unlock the course here: <a href="${unlockUrl}">${unlockUrl}</a></p>` +
      `<p>Enter your email and this key to start. Keep the key somewhere safe.</p>`,
  });
  if (error) throw new Error(`Resend send failed: ${error.message}`);
}
