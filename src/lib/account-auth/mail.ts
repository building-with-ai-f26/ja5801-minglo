import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { emailAuthEnabled, localAuthTest } from "./config";
export async function sendAccountEmail(
  to: string,
  subject: string,
  text: string,
) {
  if (!emailAuthEnabled()) throw new Error("Email delivery is unavailable.");
  const id = randomUUID();
  const message = {
    from: "Minglo <no-reply@accounts.minglo.club>",
    reply_to: "jonas.altaher@gmail.com",
    to: [to],
    subject,
    text,
  };
  if (process.env.MINGLO_EMAIL_TRANSPORT === "local" && localAuthTest()) {
    const directory = join(process.cwd(), ".local", "auth-mail");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(join(directory, `${id}.json`), JSON.stringify(message), {
      mode: 0o600,
    });
    return;
  }
  // Fixed provider endpoint; no caller-supplied URLs. Reuse idempotency on retry.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": id,
        },
        body: JSON.stringify(message),
      });
      if (response.ok) return;
      if (response.status < 500 && response.status !== 429) break;
    } catch {
      /* Retry transient network failure without logging a token or address. */
    }
  }
  throw new Error("Email delivery is unavailable. Try again later.");
}
export async function notifyAccount(to: string | null, text: string) {
  if (!to || !emailAuthEnabled()) return;
  try {
    await sendAccountEmail(
      to,
      "Your Minglo sign-in settings changed",
      `${text}\n\nIf this wasn't you, contact jonas.altaher@gmail.com.`,
    );
  } catch {
    console.error("Account security notification delivery failed.");
  }
}
