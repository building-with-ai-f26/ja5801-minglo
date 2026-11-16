# PostHog dashboard and playback images

Received from Jonas's private Google Drive evidence folder on November 16, 2026.
Muse captured the dashboard around 10:49 AM Eastern and the replay around
10:50 AM. Codex retrieved both original PNGs using the connected Drive account,
inspected them individually, and copied them without alteration. Drive sharing
was not changed. The public copies are explicitly requested submission evidence.

| Original | Published copy | Dimensions | Bytes | SHA-256 |
| --- | --- | --- | --- | --- |
| dashboard.png | [Dashboard](../images/build2-posthog-dashboard.png) | 1020 × 1320 | 211959 | `1eb4413c5c1ee678b60510f071c45c321f9f28f84d53ce385d33725b9ab1e8d1` |
| replay.png | [Replay player](../images/build2-posthog-replay.png) | 1020 × 1320 | 158543 | `71e3a769dbde94fb45679311c1d4a63a2fe1837f6d3ca541bb2d78196b7dfe56` |

## What the dashboard shows

The image is the actual **Your starter dashboard** in US project 739580,
[dashboard 2360648](https://us.posthog.com/project/739580/dashboard/2360648).
It visibly shows **9 active users, last 30 days**. No sample-data label is visible.
The date control reads “No date range override” and “each insight's interval.”

Muse's supplied notes additionally report **4 sessions, last 7 days**, and
**9 pageviews, last 7 days**. Those tiles are outside the supplied screenshot;
they are relayed observations, not independently visible image evidence.
The reported visit-to-interaction funnel has 9 page viewers and 0 interactions.
Minglo's custom button events have separate wire evidence; the starter funnel
is not substituted for event-specific verification.

## What the replay shows

The local replay screenshot shows a painted, masked page in the actual player,
not the Inspector. The visible time counter is approximately one second; Muse
reports about 1–2 seconds, four clicks, two key presses and no errors for
`/demo/github-profile`. This was an explicitly approved automated technical demo,
not a human usability study or proof of an unattended personal agent.

Local capture and the same-tab opt-out check are documented in the
[sanitized live record](build2-live-replay.json): real snapshot HTTP 200,
65-second open-tab observation, no new event on a further tracked action, and
session-derived eligibility null after opt-out.

Muse separately reported a **2:18 public Product Page recording** whose masked
DOM existed but whose playback area rendered black. An earlier roughly one-minute
recording never appeared. These are disclosed limitations; the local screenshot
does not prove those separate public recordings played correctly.

## Reported settings and evidence limits

Muse's notes report replay URL triggers limited to the public Product Page and
localhost, with deployed app domains excluded; Total privacy masking;
console/network/canvas recording off; 100% sampling; **30-day replay retention**.
Product event retention remains **one year**. The local code additionally enforces
exact safe-page URLs and separate per-visit recording consent. No general
autocapture or private conversation recording was enabled for this publication.

The private original notes and project replay URLs are retained locally and are
not republished wholesale. This record distinguishes visible screenshot evidence,
Muse's observations and the earlier direct browser/wire checks.
