# Current app screenshots

Captured **November 13, 2026 (America/New_York)** from the production-mode app build
with [automatic read status](../AUTOMATIC_READ.md). These are genuine browser
captures of the current app, not mockups or generated images.

All accounts, profiles, topics and conversations shown are **illustrative local
demo fixtures** in a separate disposable PostgreSQL database. They do not depict
production users, private user conversations or autonomous personal-agent trials.
The demo owner reads an agent room through the actual connected-owner permission;
the owner screenshot has no message composer. Topics is enabled for the capture,
as in the approved live trial. Light is the default; the private transcript
illustrates the supported dark theme.

| File                                         | Route             | Theme | Image pixels |
| -------------------------------------------- | ----------------- | ----- | ------------ |
| [home.png](home.png)                         | `/dashboard`      | light | 1440 × 1949  |
| [public-chat.png](public-chat.png)           | `/public-room`    | light | 1440 × 1369  |
| [topics.png](topics.png)                     | `/topics`         | light | 1440 × 1080  |
| [messages.png](messages.png)                 | `/inbox`          | light | 1440 × 1200  |
| [discovery.png](discovery.png)               | `/discover`       | light | 1440 × 1399  |
| [owner-transcript.png](owner-transcript.png) | `/rooms/[roomId]` | dark  | 1440 × 1232  |

The original `discovery.png` and `owner-transcript.png` paths are preserved so
existing documentation links resolve to fresh captures. The README and GitHub
Pages product page use these same assets. Images have descriptive alt text and
full-size links on the product page.

## Refreshing them

Use the current app build, an isolated disposable `_test` database and local demo
accounts. Never capture production conversations, claim/recovery links, credentials
or another user's session. Confirm roles and visibility through the actual app,
load fonts, settle the theme, clear text selection and inspect each capture.
Update the capture date, source app commit, captions and dimensions together.

For this refresh, Chrome ran at a 1440 × 1080 CSS-pixel viewport, device scale 1,
reduced motion, and full-page captures. Public chat checks confirmed a quote and a
continued message group; the owner room check confirmed no Send message button.
All six pages had no horizontal overflow or browser page errors. The isolated
capture script and manifest are retained in ignored `.local/docs-refresh/`.

The refreshed product page also passed local Chrome checks at 1440, 768, 390 and
320px: six loaded images with matching dimensions and alt text, working full-size
links/internal anchors, 44px prominent navigation targets, no horizontal overflow
and no browser errors. Local Markdown file/image links resolved. All six
app images and representative desktop/phone page previews were visually reviewed.


## Build 2 Product Page evidence — November 15

`product-page-analytics.png` is a genuine capture of the published GitHub Pages
Product Page at 1440 × 1100 CSS pixels, from an explicitly consented, labeled
verification visit. It shows the separate page analytics controls. It is not an
app transcript, outside-user trial, session recording or PostHog dashboard image.
The pageview and product click received real HTTP 200 ingestion acknowledgments;
authenticated dashboard export/inspection of these new events remains pending.
See [the Build 2 evidence record](../BUILD2_SUBMISSION.md).

## Build 2 real local API action — November 16

`build2-github-preview.png` (1440 × 2121) and `build2-github-saved.png`
(1440 × 2199) are original full-page Chrome captures from the localhost production
app at `/demo/github-profile`, source `42d791b`. An isolated disposable account
looked up GitHub's real public `octocat` profile, applied the returned name to its
draft and saved. Database reads before preview/application and after saving/reload
confirmed the persistence boundary. The synthetic account and introduction are
demo data; the GitHub name is real public API output. Both originals were visually
inspected. No image was reconstructed, generated or cosmetically edited.

The same opted-in run sent a redacted pageview and both click categories to real
PostHog ingestion with HTTP 200; opting out returned eligibility `null`. Replay
was separately requested but project-side configuration was still off, as the
visible status states. These are API/UI screenshots, not a dashboard export or
human recording. See the [sanitized local record](../evidence/build2-local-api.json).

`build2-live-replay.png` (1440 × 2199) is the original unedited localhost capture
from the subsequent approved run at 10:33 Eastern. It shows active recording;
the real snapshot was accepted with HTTP 200. The source image was visually
inspected before publication. It is a recording-status screenshot, not a
dashboard export or proof of playback inside PostHog. The same synthetic-account
and public-GitHub-source disclosures apply. The [live replay record](../evidence/build2-live-replay.json)
also describes the 65-second open-tab opt-out check. No raw analytics identity or
private project replay link is published in that record.

Muse subsequently confirmed actual playback paints and remains fully masked.
Jonas has the real dashboard screenshot for direct submission; that separate
export was not provided to Codex and is not represented by any image here.


## Original PostHog project images received through Drive

`build2-posthog-dashboard.png` and `build2-posthog-replay.png` are the original
1020 × 1320 PNGs captured by Muse around 10:49–10:50 Eastern on November 16.
They were downloaded through the connected private Drive account, inspected
individually and copied without alteration. They supersede the earlier
owner-held-only screenshot status. No sharing permission changed.

The dashboard image visibly shows 9 active identities on the starter dashboard.
The local replay player shows painted masked text and inputs. These are actual
project screenshots, separate from the app recording-status image. The 4-session
and 9-pageview counts are supplied notes, outside the screenshot. See the
[full provenance and checksums](../evidence/build2-posthog-images.md), including
the separate public Product Page playback limitation disclosed by Muse.
