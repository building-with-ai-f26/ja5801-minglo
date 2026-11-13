# F1 verdict pass

For the **same independent reviewer**, read-only. Preserve `review.md` as the original report. Write the scoped verdict to `docs/handoffs/app-structure/review-f1.md`. Do not edit app/tests/design/coordinator files, start servers/tests, commit, push or deploy. This verdict scores F1’s correction only; the original review’s other coverage and limits remain.

## What changed

F1 was the only required hold. The coordinator took the narrow CSS/helper lease after all workers released runtime/source work. Exactly three app/test files differ from D’s verified snapshot:

1. `src/components/app-shell.css`: fixed shell labels use normal word wrapping/breaking, rather than breaking anywhere.
2. `src/app/side-by-side.css`: mobile primary cells keep readable 13px type but remove extra inline padding and inter-cell gaps. The More destination list becomes one column with full-width nonshrinking items; its existing viewport height/scroll bound stays. No label is hidden, clipped, ellipsized, shortened or rendered in smaller type. Theme pill, light/dark palette, destination list, gate and touch-target policy are unchanged.
3. `tests/e2e/app-structure-navigation.ts`: new `expectNavigationWordsIntact` creates DOM Ranges for each fixed label word. It asserts each word occupies one rendered line and fits inside its control, in both closed and expanded navigation. All previous navigation, gate, target, keyboard/focus, theme and overflow assertions remain.

The coordinator compared all other verified source/test/config hashes against D’s final manifest: unchanged. Updated product/design status documentation describes the new arrangement but introduces no new visual system/token values. F2 and F3 remain inherited follow-ups from the original review, not silently declared fixed.

## Actual verification

- The new word assertion was run against the **old production build**, with retained local fixture accounts and no DB reset. It failed with the required “word must stay intact” assertion. Saved expected failure: `.local/app-structure/f1/baseline/checks.json`, original `.local/app-structure/f1/baseline/expected-word-split.png`, and `baseline.log`.
- First F1 application-fix batch: **passed**. `npm run build` and `npm run typecheck` passed; formatting/whitespace checks passed.
- Against the corrected production build, the existing shared `checkStructureNavigation` helper including the new word checks passed for both roles, light/dark, Topics on/off, 1440/360/320px and More open/closed. **48 fresh full original captures; 4 role/gate executions; 0 page errors**. The helper also retains all its active-state, actual destination count, 44px target, 64px theme width, keyboard/focus, More-close and overflow checks.
- Commands: `node --import tsx .local/app-structure/f1/check-navigation.mjs --baseline` for old-build proof; after CSS correction/build, the same script without `--baseline` for the full targeted matrix. It imports the actual shared test helper. No suite assertion was weakened, no database reset or domain/privacy/write change occurred. Script-owned processes were stopped in finally.
- Logs: `.local/app-structure/f1/{baseline.log,build.log,typecheck.log,final.log}`.
- The earlier 115 default + 2 off cases and both restart passes remain evidence for the unchanged behavior layer. They were **not rerun after this CSS/helper correction**; no such claim is made. The fresh targeted matrix is the post-fix evidence required by F1.
- Failed-fix count: **0**; this is the first correction batch and it passed. No second detector run or unrelated defect hunt.

## Fresh originals and integrity

Use `.local/app-structure/f1/final/checks.json` for exact paths/hashes and gate/role execution results. All 48 final originals were independently hash-checked by the coordinator. Current source hashes and the exact three changed files are in `.local/app-structure/f1/source-manifest.json`.

Every original is under `.local/app-structure/f1/final/`:

```text
nav-{OWNER|AGENT}-{on|off}-{1440|360|320}-{light|dark}-{closed|open}.png
```

The correction changes navigation across pages; body content is retained local fixture evidence. Full-page heights can exceed 960px. Inspect fresh originals for fixed-word readability and control/menu fitting, especially both roles/gates/themes at 320/360px in closed/open states. Desktop confirms no regression in the sidebar. Do not use the old D navigation images to judge the correction. Contact sheets, if present, are orientation only.

## Requested verdict

Score **F1 resolved / partial / unresolved** with original capture and source evidence. Check the actual font/targets/content, not only the test counts. Identify any regression caused by this fix; keep optional inherited F2/F3 separate. Use the five finish-review sections and an explicit disposition. A ship verdict here covers the listed fix, not a new whole-app audit. If evidence is invalid, name the specific recapture needed rather than treating it as a design failure.

Return the scoped verdict to Jonas and leave all source untouched. Coordinator handles final Git integration after consuming it; do not deploy.
