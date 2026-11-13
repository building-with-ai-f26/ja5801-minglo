disposition: ship

**F1 resolved.** This scoped verdict lifts the navigation-readability hold in `review.md`. It covers the F1 CSS correction, its regression helper and fresh navigation evidence only. The original report, other coverage and limitations remain; this is not a new whole-app audit, deployment approval or claim of final Git integration.

## persistence

**Pass.** Read `review-f1-brief.md`, the two corrected CSS files, the shared navigation helper, F1 capture/source manifests, capture-runner source and saved baseline/build/typecheck/final logs. Existing PRODUCT/DESIGN context and the original review remain the authority for the retained Side by Side identity.

Independently recomputed all **53** hashes in `.local/app-structure/f1/source-manifest.json`: every entry matches current source. Comparing current files with D's verified manifest confirms exactly the three declared differences: `src/components/app-shell.css`, `src/app/side-by-side.css`, and `tests/e2e/app-structure-navigation.ts`. All **48** fresh-original hashes match `.local/app-structure/f1/final/checks.json`, with no missing role/gate/viewport/theme/menu combination.

I directly inspected **all 48 final full originals**, not contact sheets or the old D captures. Exact inventory: `.local/app-structure/f1/final/nav-{OWNER|AGENT}-{on|off}-{1440|360|320}-{light|dark}-{closed|open}.png`, the complete Cartesian product. Each shows the expected role, gate, theme and menu state, with document top visible and no blank/malformed capture. PNG widths match 1440/360/320; full-page heights exceed the 960px viewport as expected. No recapture is required.

Saved verification records show build/typecheck passing and four successful role/gate executions of the actual shared helper, producing the 48 captures with zero page errors. The saved negative control reports the new assertion failing against the old production build: `Manage participation: word "participation" must stay intact`, expected one rendered line, received two. This establishes a meaningful regression check rather than a check that always passes. I inspected these records; I did not rerun their commands.

## fidelity

| Check | Judgment and evidence |
| --- | --- |
| Primary fixed words | **Match; F1 resolved.** `src/app/side-by-side.css:924–950` removes inter-cell gaps and inline cell padding while retaining 13px type and 48px minimum height. `src/components/app-shell.css:1–5` and the primary label rule use normal word wrapping. Fresh `nav-OWNER-on-320-light-closed.png` and `nav-AGENT-on-320-dark-closed.png` show **Messages** intact, with **People & agents** wrapping between words. The same holds throughout the inspected 320/360px matrix. |
| More labels and fitting | **Acceptable adaptation required by F1.** `src/app/side-by-side.css:966–989` makes the destination list one column and its items full-width/nonshrinking, retaining 14px type, padding, viewport height bound and vertical scrolling. Fresh `nav-OWNER-on-320-light-open.png`, `nav-AGENT-on-360-dark-open.png`, `nav-OWNER-off-360-dark-open.png` and their matrix counterparts show **Manage participation** complete and readable. All menu labels fit; none is shortened, clipped or ellipsized. |
| TYPE | **Match.** Existing heading/brand character and navigation text size remain. Fitting comes from allocating space; no smaller type or replacement label is used. |
| MATERIAL / GROUND | **Match.** Cobalt/ivory light and navy/blue dark surfaces, SVG icons, flat borders and active-state treatment remain consistent in fresh originals. No material, palette or decorative system was introduced. |
| Role/gate structure | **Match.** Enabled navigation retains four primary destinations; disabled navigation fills three actual cells without a blank slot. Human More includes My agents; agent More omits it. Remaining destinations are retained. |
| Desktop | **Match.** All sixteen 1440px originals retain a readable sidebar in both themes, roles, gates and menu states. Manage participation may occupy two lines **between words**, with no split word. No desktop regression from the normal-wrapping change is visible. |
| Targets, focus and theme pill | **Preserved in the available evidence.** Open originals show visible More focus and comfortably separated full-width menu items. The unchanged helper assertions require at least 44px targets and a 64px theme pill, plus active state, keyboard navigation, More closure and no horizontal overflow. All four saved executions passed. Source retains the minimum heights; static images alone do not independently measure every interactive target. |

The menu still overlays underlying content while expanded. The single-column arrangement is taller, but every destination fits inside the captured viewport and the existing scroll bound remains. This is consistent with the accepted nonmodal disclosure behavior; no new obstruction or lost destination was found in the scoped matrix.

## ceiling

**Reached for F1.** The correction resolves the stated defect through spacing and menu arrangement while retaining readable type, destinations, touch-target policy and both themes. No further design change, rebuild or capture round is justified by this evidence.

Limits remain explicit: the fresh captures exercise the shared navigation on Home at 1440/360/320px with a 960px viewport height. They are not a new audit of every page body, other browser engines, increased text scaling, shorter devices, physical touch or screen readers. The earlier 115 default cases, two separate Topics-off cases and restart checks were **not rerun after F1**. Their earlier results remain evidence for the unchanged behavior layer; the fresh targeted matrix supplies the post-fix navigation evidence.

## material_fixes

**None for the F1 correction. No regression caused by this fix was identified in the inspected source and fresh captures.**

The regression helper at `tests/e2e/app-structure-navigation.ts:3–46` measures each fixed label word with DOM Ranges, requiring one rendered line and bounds inside its control. It runs before both closed/open captures (`:100`, `:160`). This closes the original overflow/target-only coverage gap while still allowing legitimate wrapping between words. The previous role/gate/destination, target, focus, keyboard, theme-width and overflow assertions remain present.

F2 (inherited Public chat title collapse on Agent rooms) and F3 (inherited Home aggregate-link mismatch) remain optional follow-ups exactly as recorded in `review.md`; neither was changed or declared resolved here. This scoped ship verdict does not certify their affected bodies.

## keep

Keep intact fixed words, readable 13px primary/14px More labels, full-width nonshrinking menu items, the viewport scroll bound, existing focus/target checks, role/gate destinations, theme pill and Side by Side palette. The coordinator can consume this verdict for final integration. Source and `review.md` were left untouched; only this scoped report was written. No server/test/build, commit, push or deployment was performed by this reviewer.
