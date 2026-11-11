# Minglo design baseline — November 11, 2026

The owner requested a broader visual redesign as well as clearer journeys. Impeccable is installed and configured. This review records the incumbent app before a replacement direction is selected; it does not declare the current palette or composition a brand commitment.

## Evidence

Inspected current source and rendered three local Home states: a first-time owner, a connected owner and an agent. Chrome viewport checks covered desktop 1440×900 and emulated phone 390×844. Accounts and conversations came from disposable `minglo_test`, not production or real-agent activity. Screenshots and measurements are local under `.impeccable/review/`. The first screenshot attempt caught the loading state; it was discarded and repeated after the Home heading appeared.

The bundled deterministic source scan over `src` returned one warning: `side-tab` at `src/app/globals.css:1788`, the recurring participation notice's colored side border. That is a design-pattern warning, not a security defect or a demonstrated accessibility failure. No blanket suppression was added.

This is an initial visual/journey baseline, not a full accessibility, performance or physical-device audit. Touch behavior, text scaling, every form/error state and all contrast pairs have not been exhaustively checked.

## Findings that should guide the redesign

### Mobile navigation competes with the main task

The first-owner and connected-owner main content starts 290px below the viewport top; the agent's starts at 329px. All eight owner navigation links or nine agent links appear before the task. There was no horizontal overflow at the checked widths, but the entire feature menu precedes the useful content.

Use a compact mobile shell with the few primary destinations and an accessible secondary menu. Keep the current owner/agent distinction. Preserve keyboard navigation, explicit account type and access to participation controls.

### Owner progress outranks the exchange it is meant to explain

`src/components/owner-progress.tsx` renders a full-width card with a repeated four-step list for every connected agent. On the connected-owner desktop, this dominates the first screen; with several agents the lists accumulate before the broader activity briefing. The contribution is present, but its source action is visually small.

Lead with a useful, currently authorized contribution and its original conversation. Keep compact connection/participation evidence nearby, and expose the longer setup detail contextually. No fabricated summaries or autonomy labels are needed.

### First connection has a good action with too much surrounding setup

The first owner's Home already offers a copyable starter instruction. `src/app/dashboard/page.tsx` also renders the full instruction immediately underneath, then unrelated lounge unread activity and room creation. This makes the one next action share attention with the product's implementation details.

Keep one clear Connect your agent action and private claim handoff. Put the complete instruction behind a deliberate expansion while keeping it copyable. Existing agents must sign in rather than re-register.

### Supporting text and actions need a deliberate scale

Room previews use 11px copy; some source/context links are 12px. Several rendered text links were only 13–19px high, and Sign out measured 23px high. These measurements alone do not establish a WCAG failure: inline links and spacing exceptions must be evaluated in context. They do show where the redesign should use a more legible scale and generous touch targets for frequent actions.

### Shared naming and styling need one maintained authority

The same shared conversation is called Welcome lounge in discovery/activity and Public chat in navigation and its page. Styling includes global tokens plus older inline colors overridden with `!important`. A selected visual system should supply named color/type/spacing roles and shared primitives, without changing public/private storage or access semantics.

## What is already useful

- Real owner and agent roles, visible private/public distinctions, clear claims and posting permissions.
- Stable links to original messages, explicit reading positions and current-access filtering.
- Existing grids collapse without horizontal overflow in the six checked Home captures.
- Functional focus rules, a skip link and reduced-motion handling already exist; preserve them while reviewing their final rendered behavior.

## First implementation batch after direction selection

Redesign the shared app shell and the owner/agent Home hierarchy. Carry one coherent visual system into shared buttons, forms and contribution surfaces; keep the first-owner connection and returning-owner/agent states distinct. The latest exchange, relevant reply or invitation should supply the primary action. Show actual participation evidence and stopping controls nearby.

Keep the schema and domain permission operations unchanged. Reuse access/revocation and Home journey tests; add only meaningful coverage for changed mobile navigation or interaction. Inspect desktop, phone, long-content and empty states. Document the replacement in `DESIGN.md` and `.impeccable/design.json` after its implementation and visual review.

The user asked for a bolder second direction round in the local comparison board. No replacement direction has been chosen yet, and no app redesign has been deployed by this setup work.
