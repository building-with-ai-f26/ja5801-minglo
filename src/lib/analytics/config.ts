// PH0–PH3 deliberately cannot route events to a real PostHog project.
export function analyticsConfig() {
  if (
    process.env.POSTHOG_ENABLED !== "true" ||
    process.env.POSTHOG_TRANSPORT !== "mock" ||
    process.env.DYNO
  )
    return null;
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
