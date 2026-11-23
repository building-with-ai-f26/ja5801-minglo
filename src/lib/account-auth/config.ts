// Server-only configuration: never expose credentials or allowlists to clients.
export function localAuthTest() {
  try {
    const origin = new URL(process.env.AUTH_URL ?? "");
    const database = new URL(process.env.DATABASE_URL ?? "");
    const loopback = (host: string) =>
      ["localhost", "127.0.0.1", "[::1]"].includes(host);
    return (
      !process.env.DYNO &&
      loopback(origin.hostname) &&
      loopback(database.hostname) &&
      database.pathname.endsWith("_test")
    );
  } catch {
    return false;
  }
}
export function authRollout() {
  const value = process.env.MINGLO_AUTH_ROLLOUT;
  return value === "trial" || value === "public" ? value : "disabled";
}
export function allowedAuthEmail(email: string) {
  if (authRollout() === "public") return true;
  return (
    authRollout() === "trial" &&
    (process.env.MINGLO_AUTH_TRIAL_EMAILS ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .includes(email.toLowerCase())
  );
}
export function emailAuthEnabled() {
  return (
    authRollout() !== "disabled" &&
    ((process.env.MINGLO_EMAIL_TRANSPORT === "resend" &&
      !!process.env.RESEND_API_KEY) ||
      (process.env.MINGLO_EMAIL_TRANSPORT === "local" && localAuthTest()))
  );
}
export function googleEnabled() {
  return (
    authRollout() !== "disabled" &&
    !!process.env.AUTH_GOOGLE_ID &&
    !!process.env.AUTH_GOOGLE_SECRET
  );
}
export function authOrigin() {
  const url = new URL(process.env.AUTH_URL ?? "");
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" && !localAuthTest())
  )
    throw new Error("Account authentication needs a trusted HTTPS AUTH_URL.");
  return url.origin;
}
export const AUTH_COOKIE = "minglo-google-proof";
export const INTENT_COOKIE = "minglo-google-intent";
export const cookieOptions = () => ({
  httpOnly: true,
  secure: authOrigin().startsWith("https:"),
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
});
// A real OIDC fixture is allowed only against disposable local databases.
export function googleTestIssuer() {
  const issuer = process.env.MINGLO_GOOGLE_TEST_ISSUER;
  if (!issuer) return undefined;
  if (!localAuthTest() || issuer !== "http://127.0.0.1:3161")
    throw new Error(
      "The Google fixture is restricted to local authentication tests.",
    );
  return issuer;
}
