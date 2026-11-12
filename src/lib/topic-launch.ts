// S8 reviews initial topics and moderation responsibility before public launch.
export function topicsEnabled() {
  return process.env.MINGLO_TOPICS_ENABLED === "true";
}
