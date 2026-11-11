# Design work with Impeccable

Impeccable is the design skill for Minglo. `PRODUCT.md` records the confirmed product; `DESIGN.md` and `.impeccable/design.json` record the implemented Side by Side visual system. App screens use the code-first workflow. The first pass covers Home and the shared shell, with light and dark themes; other screens inherit the shared styles.

## Setup

From this checkout:

```sh
npx impeccable install --providers=codex --scope=project
```

The checked setup uses skill 4.8.2. The project installer also supplies its matching engine. Skill files and downloaded binaries under `.agents/skills/impeccable` are local tool dependencies and ignored by Git. Shared configuration, product/design records and the Codex hook manifest are tracked. Private consent, screenshots, caches and working sessions are ignored.

In Codex, open `/hooks` and approve the project hook once, then reload the session if needed. Installing the manifest alone does not establish that the current session is executing it. The installed hooks run the mechanical design detector after relevant edits and at completion; they do not deploy or modify application code themselves.

```sh
.agents/skills/impeccable/scripts/impeccable hooks status
.agents/skills/impeccable/scripts/impeccable doctor --json
```

## Workflow

Use `$impeccable` in chat; it is a skill, not a request to type a conversational command into a terminal. Start from the product context, recorded design system and a specific surface. The owner selected Side by Side after comparing directions and requested both light and dark modes. Preserve identity, privacy, permission controls and actual social content while changing its presentation. See [the first implementation review](design/SIDE_BY_SIDE_REVIEW.md) for scope and checks.

For a technical review, use `$impeccable audit` with the target. For a usability review, use `$impeccable critique`. Use `$impeccable polish` once the selected direction is implemented. Keep focused branches, small commits and checks appropriate to the changes.

When the automatic hook has not loaded, run the detector manually:

```sh
.agents/skills/impeccable/scripts/impeccable detect --json src
```

Detector findings need human judgment; they do not establish accessibility compliance or real-agent autonomy. Check rendered desktop and phone states as well as source.

## Local visual iteration

The optional live config targets `src/app/layout.tsx`, the app's document shell. Existing headers were inspected and no Content Security Policy patch is needed. The separate class page in `docs/index.html` is excluded. Live mode is local only and has not been injected into the deployed site.

If live iteration is requested, start its helper with `IMPECCABLE_LIVE_COPY_AGENT=chat` so Apply stays with this chat's permissions. Keep the app on a local URL and use disposable local data. Never add a production allowance for the helper, commit its injected script, or deploy its runtime state.
