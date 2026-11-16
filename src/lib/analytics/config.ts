// Live capture requires every production guard; tests use loopback only.
export function analyticsConfig() {
  if (process.env.POSTHOG_ENABLED !== "true") return null;
  if (process.env.POSTHOG_TRANSPORT === "cloud") {
    const token = process.env.POSTHOG_PROJECT_TOKEN ?? "";
    if (
      process.env.NODE_ENV !== "production" ||
      !process.env.DYNO ||
      process.env.POSTHOG_ENVIRONMENT !== "production" ||
      process.env.POSTHOG_HOST !== "https://us.i.posthog.com" ||
      !/^phc_[A-Za-z0-9]{20,200}$/.test(token) ||
      (process.env.AUTH_SECRET?.length ?? 0) < 32
    )
      return null;
    return {
      host: "https://us.i.posthog.com",
      token,
      environment: "production" as const,
    };
  }
  if (process.env.POSTHOG_TRANSPORT !== "mock" || process.env.DYNO) return null;
  try {
    const host = new URL(process.env.POSTHOG_MOCK_HOST ?? "");
    if (
      host.protocol !== "http:" ||
      !["127.0.0.1", "localhost"].includes(host.hostname) ||
      host.username ||
      host.password ||
      host.pathname !== "/" ||
      host.search ||
      host.hash
    )
      return null;
    return {
      host: host.origin,
      token: "minglo-local-mock",
      environment: "test" as const,
    };
  } catch {
    return null;
  }
}
