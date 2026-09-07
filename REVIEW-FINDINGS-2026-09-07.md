# Code Review — Mathilda (2026-09-07)

> Empirical review pass run after the 2026-08-18 settings/privacy refactor
> plan was marked COMPLETE. Scope: working tree at `main` (commit `d92411d`),
> `dotnet build` + `dotnet test` re-run from scratch, all source `.cs`/`.razor`/
> `.js`/`.ts` re-read against the live tree.
>
> Method: per-file verdict against the live tree + targeted feature-reachability
> probes (does the claimed UI affordance actually wire to the backend, or does
> it silently lie to the user?).
>
> Build/test evidence: `dotnet build -c Release` -> 0W/0E (15s); `dotnet test
> -c Release` -> 42/42 passed (8.3s).
>
> Status of original plans: both `docs/plans/2026-08-18-settings-privacy-
> refactor-PLAN.md` and `docs/plans/2026-08-14-csharp-rebuild.md` marked
> COMPLETE. This review is the post-completion close-the-loop pass.

## Summary

| # | Severity | Area | Status in this commit |
|---|----------|------|-----------------------|
| F1 | HIGH | PlacesService radius filter silently dropped on live path | FIXED |
| F2 | MED | InteropContractTests tautologies (StorageClear + ServiceWorkerUpdate) | DEFERRED (next round) |
| F3 | MED | convex/settings.ts schema has 8 dead fields with no C# callers | FIXED |
| F4 | LOW | README doc-drift (v0.2.0 tagged + real video assets claims) | FIXED |
| F5 | LOW | convex/weather:get ignores its args - "live data" UI badge misleading | DEFERRED (needs weather provider) |
| F6 | LOW | StartupVideoIntro spinner flash | DEFERRED (cosmetic) |
| F7 | LOW | docs/.scratch-audit/runtime/* committed before .gitignore order | DEFERRED (separate cleanup PR) |

## F1 (HIGH) - PlacesService radius filter silently dropped on live path

Files: src/Mathilda/Services/PlacesService.cs:18, convex/places.ts:list,
src/Mathilda/Pages/AttractionsPage.razor:60.

AttractionsPage renders "Places within 10 km of @_locationName" and calls
Places.FetchNearby(10). Mock path uses radiusKm to space fixture entries.
Live Convex path called QueryAsync("places/list") with NO args - radiusKm
silently discarded. Convex places/list handler accepts args:{} and returns
ALL rows. This is the feature-flag-bridge gap pattern.

Fix: C# PlacesService.FetchNearby now passes { radiusKm, lat, lng }. Convex
places/list accepts those args, applies haversine filter against stored
lat/lng. Places without lat/lng returned as-is (no regression for fixtures).
Regression test (PlacesService_FetchNearby_LivePath_PassesRadius) asserts
the wire payload.

## F3 (MED) - convex/settings.ts schema has 8 dead fields

convex/settings.ts schema declares 11 fields. C# AppSettings only carries 3
(OBJ-08 stripped the rest). settings/get + settings/save have ZERO C#
callers. Schema + table + both functions are dead code.

Fix: stripped schema to three fields C# actually uses (skipStartupVideo,
showInstallPrompt, customConvexUrl). Simplified settings/get + settings/save
to the matching shape.

## F4 (LOW) - README doc-drift

README claimed v0.2.0 released (tagged) + real video assets .webm/.mp4.
Commit d92411d removed those video files as orphans. git tag -l is empty.
Both statements are stale.

Fix: README rewritten to drop false v0.2.0 tagged claim, describe startup as
honest SVG-only path, link this review doc.

## Validation (this commit)

| Check | Result |
|-------|--------|
| dotnet build src/Mathilda -c Release | 0W / 0E |
| dotnet test tests/Mathilda -c Release | 43 passed / 0 failed (+1 F1 test) |
| F1 wire payload probe | radiusKm + lat + lng in Convex envelope |
| F3 schema probe | npx convex dev not run (no deploy key); schema edit only |
| F4 README probe | no v0.2.0 mention; no .webm/.mp4 claim |

## Recommendation

READY WITH WARNINGS. F1 (HIGH) and F3 (MED) fixed inline. F4 (LOW) sync done.
F2 (test hygiene) and F5 (live weather provider) deferred. F7 (committed
scratch-audit) needs separate cleanup PR with user approval.
