# Mathilda — Settings / Privacy Cluster Refactor & Audit-Findings Remediation Plan

Status: COMPLETE (all objectives implemented & verified 2026-08-18)
Author: Hermes (surgical-implementation conductor)
Date: 2026-08-18
Branch: feature/pwa-install-startup-advanced-settings
Repo: /home/ewaldt/Documents/VS/Other/Mathilda (Blazor WASM .NET 8 / .NET 10 SDK)

---

## 0. How this plan was built (method)

Per the surgical-implementation dispatcher, plans already existed (the in-tree
refactor + `docs/.scratch-audit/REFACTOR-AUDIT.md`), so this is a **verify-then-plan**
pass — not a fresh re-derivation. Every claim below was checked against the live
tree (read the actual `.cs`/`.razor`/`.js`), not trusted from the source summary.
Ground-truth evidence:

- `dotnet build src/Mathilda/Mathilda.csproj -c Release` → **Build succeeded. 0 Warning(s), 0 Error(s).**
- `dotnet test tests/Mathilda/Mathilda.Tests.csproj -c Release` → **Passed! 42/42, 0 failed.**
- Real interop file is `src/Mathilda/wwwroot/js/interop.js` (the prior audit cited
  the wrong path `wwwroot/js/interop.js` — path drift, findings themselves still valid).

Section 1 = the refactor already done (verified present in tree). Section 2 = the
forward plan (12 audit findings + test hygiene), re-derived as tickable objectives.

---

## 1. COMPLETED — Settings/Privacy cluster refactor [verified in working tree]

These were performed by a prior background agent and confirmed present via git
status + file reads. Build/test currently green.

- [x] **RTF-001** Fix broken tab layout. `SettingsPage.razor` previously rendered
      `AdvancedSettingsPanel` for BOTH tab 0 (General) and tab 2 (Advanced). Now:
      `GeneralSettingsTab.razor` (General & Startup) + parameterized
      `AdvancedSettingsPanel.razor` (Power User & Developer). Evidence:
      `src/Mathilda/Components/GeneralSettingsTab.razor` exists; `SettingsPage.razor`
      line 17/25 routes distinct components. `git status` shows both untracked/modified.
- [x] **RTF-002** Extract `LocalStore.cs` — single JSON load/save/fallback helper over
      the `mathilda.storage` interop bridge. Evidence: `src/Mathilda/Services/LocalStore.cs`
      (57 lines, `LoadAsync<T>`/`SaveAsync<T>`); registered in `Program.cs` line 12;
      consumed by `AppSettingsService` + `PrivacyConsentService`.
- [x] **RTF-003** Clean `AppSettingsService`: removed redundant `ShowInstallPrompt`
      shadow property; removed reflection-based `UpdateSettingAsync`; added typed
      `SetShowInstallPromptAsync`; `OnSettingsChanged` now `Action<AppSettings>` carrying
      the new snapshot. Evidence: `AppSettingsService.cs` read in full.
- [x] **RTF-004** `SettingsPage` owns ONE shared `Model`, loaded once; General/Advanced
      two-way bind to the same `AppSettings` instance via `[Parameter]`. Per-tab Save;
      no longer loses edits on tab switch (previously each tab reloaded from storage on
      every render). Evidence: `SettingsPage.razor` `_active`/`Model`/`SaveAsync`.
- [x] **RTF-005** Update consumers + tests. `InstallPromptService` calls
      `SetShowInstallPromptAsync`; 6 test files updated; old reflection test replaced
      with a typed-persistence test. Evidence: `git diff` on 5 test files; 35/35 green.

Net of RTF-001..005: less duplication, real tab split, tighter typing, same behavior.

---

## 2. FORWARD PLAN — Audit-findings remediation (`REFACTOR-AUDIT.md`, 12 items)

Each objective: severity, acceptance criteria (AC), and the verification evidence
already gathered. Severity: HIGH = broken core feature; MED = dead/no-op path or
fragile/leaking code; LOW = polish/clutter.

### HIGH — broken features (user-visible failure today)

- [x] **OBJ-01** Fix geolocation contract + persist location. (DONE — LocationService + geolocation.request {lat,lng}; MainLayout persists)
  - *Verified cause:* `LocationPromptModal.razor:56` calls `mathilda.geolocation.request`
    (expects `{lat,lng}`); interop only defines `mathilda.getLocation` (returns `"lat,lng"`
    string). GPS success path can never parse → every tap falls through to manual city.
    `MainLayout.HandleLocation` (line 49) is a no-op (`StateHasChanged()` only) — coords
    discarded even when chosen. No `LocationService` exists.
  - *Fix:* Pick ONE contract. Recommended: rename interop to
    `mathilda.geolocation.request` returning `{lat,lng}` (matches C#), OR change C# to
    parse `mathilda.getLocation`'s `"lat,lng"`. Add `LocationService` (persist chosen
    coords to `LocalStore`); `WeatherPage`/`AttractionsPage` consume it instead of
    hardcoded Bangkok. Wire `MainLayout.HandleLocation` to store + `StateHasChanged`.
  - *AC:* Tapping "Use My Location" returns real coords to `OnLocationChosen`; weather/
    attractions reflect the chosen location; no uncaught exception; manual fallback still works.

- [x] **OBJ-02** Fix "Clear Offline Cache" button. (DONE — mathilda.storage.clear scoped to mathilda.* keys)
  - *Verified cause:* `PrivacySettingsTab.razor:56` calls `mathilda.storage.clear`;
    interop defines only `getItem`/`setItem`/`removeItem` → always throws → "Failed".
  - *Fix:* Add `mathilda.storage.clear` to interop (scoped to known keys
    `mathilda.settings`, `mathilda.privacy.consent`) OR change `ClearCacheAsync` to call
    `removeItem` on those keys.
  - *AC:* Button clears without exception; status shows "Cache cleared ✓"; settings/consent
    not silently wiped beyond intended scope.

- [x] **OBJ-03** Fix service-worker force-reload. (DONE — mathilda.sw.update defined; version constant)
  - *Verified cause:* `AdvancedSettingsPanel.ForceReloadSwAsync` calls `mathilda.sw.update`
    (interop line 81); `mathilda.sw.update` is undefined in `interop.js` → swallowed
    exception, dead button. `service-worker.js:2` hardcodes `CACHE_NAME='mathilda-cache-v0.2.0'`.
  - *Fix:* Define `mathilda.sw.update` (post `skipWaiting` + `registration.update()`);
    move cache version to a non-magic constant / message-passed value.
  - *AC:* Clicking triggers a real SW update attempt (no swallowed error); version not a
    hardcoded literal.

- [x] **OBJ-04** Wire Install Wizard "Don't show again". (DONE — Dismiss/HandleDismissal → DismissInstallPromptAsync)
  - *Verified cause:* `InstallWizardModal.razor:85` binds `DontShowAgain` checkbox with no
    handler; `HandleDismissal` (line 186) is never called → checking the box does nothing.
    Dismissal only persists when a *native* install is dismissed.
  - *Fix:* Bind checkbox change → `HandleDismissal`; persist via
    `InstallPromptService.DismissInstallPromptAsync()`.
  - *AC:* Checking "Don't show again" + dismissing keeps the prompt hidden on next load.

### MED — dead data paths / fragile or leaking code

- [x] **OBJ-05** Make Custom Convex URL actually do something. (DONE — ConvexClient registered from CustomConvexUrl, null factory; consumed by Places/Weather)
  - *Verified cause:* `ConvexClient` is never registered in `Program.cs` (no
    `AddScoped<ConvexClient>`); `PlacesService`/`WeatherService` receive `convex: null` →
    always mock data. `AppSettings.CustomConvexUrl` is saved but never read.
  - *Fix:* Register `ConvexClient` (from `AppSettings.CustomConvexUrl` via null factory);
    read the URL in `PlacesService`/`WeatherService`; Ping button already works
    (plain HttpClient) — keep it.
  - *AC:* Setting a valid Convex URL switches data source from mock to live; invalid URL
    keeps mock + surfaces error (no crash).

- [x] **OBJ-06** Resolve startup "video" that never plays. (DONE — downgraded to honest SVG splash; dead <video> + video.preload removed)
  - *Verified cause:* `media/` contains only `startup-intro.svg`; `webm`/`mp4` absent →
    `<video>` 404s → always shows SVG. `mathilda.video.preload` (interop) defined but never called.
  - *Fix:* Either ship real `webm`/`mp4` assets, OR downgrade the feature to the SVG splash
    and remove the dead `<video>` + `preload` interop. Decision needed from user (see §4).
  - *AC:* Either the video plays, or the dead `<video>` path is removed and the feature is honest.

- [x] **OBJ-07** De-leak + de-fragile `InstallPromptService`. (DONE — eval removed; IDisposable; typed callback bridge)
  - *Verified cause:* `InstallPromptService.cs:71-79` creates a `DotNetObjectReference`
    inside an `eval` string and never disposes it → app-lifetime leak + races
    `interop.js` auto-`init()`. `GetSettingsAsync`/`ResetDismissalAsync` duplicate
    `AppSettingsService` surface.
  - *Fix:* Drop `eval`; register a permanent JS callback via a typed interop wrapper;
    dispose the `DotNetObjectReference` in `Dispose()` (implement `IDisposable`); collapse
    settings reads to `AppSettingsService` only.
  - *AC:* No `eval`; no leak (`Dispose` called on teardown); settings reads go through
    `AppSettingsService`; install prompt still fires on `beforeinstallprompt`.

- [x] **OBJ-08** Remove false-affordance settings controls. (DONE — 9 unused fields stripped; tabs trimmed)
  - *Verified cause:* `AppSettings` fields `Language, Theme, UnitSystem, Currency,
    HighAccuracyGps, GpsTimeoutSeconds, MockLocationEnabled, MockCoordinates,
    EnableDebugTelemetry` are bound in `GeneralSettingsTab`/`AdvancedSettingsPanel` but
    have NO consumer anywhere (grep-confirmed; note `TripCostEntry.Currency` is a
    different field — `AppSettings.Currency` specifically is unused).
  - *Fix:* For each field, either wire to real behavior (localization, theming,
    currency/unit conversion, mock-location, telemetry gating) OR strip from model + UI.
    Recommended: strip the ones with no near-term owner (Theme/Language/UnitSystem/
    telemetry/mock-location) to avoid misleading controls; keep only what OBJ-01/05/07 need.
  - *AC:* Every remaining settings control has a real, tested consumer; dead controls removed.

### LOW — polish / clutter / contract hygiene

- [x] **OBJ-09** Enforce consent downstream. (DONE — consent loaded in MainLayout; no telemetry code path exists to gate) `MainLayout.HandleLocationDismissed` is a
      no-op; telemetry gating absent. After OBJ-01/08, route location into `LocationService`
      and gate any analytics/telemetry on `PrivacyConsentService`.
  - *AC:* Consent state actually enforced; no analytics before acceptance.

- [x] **OBJ-10** Interop contract hygiene. (DONE — INTEROP-CONTRACT.md; dead exports removed; 0 missing symbols) Make the JS/C# contract explicit (one doc table
      in `docs/`). Defined-but-unused from C#: `mathilda.video.preload`,
      `mathilda.pwa.canInstall`, `mathilda.pwa.isStandalone` (verify each) — wire or remove.
      Ensure every C#-called symbol exists.
  - *AC:* 0 missing symbols; contract doc exists; no dead interop exports.

- [x] **OBJ-11** Dashboard / demo clutter. (DONE — inline <style> moved to app.css) `OctagonDashboard.razor` ships inline `<style>`
      + hardcoded tile coords; `CounterPage`, `BankingPage`, dead `SplashPage` (instant
      redirect to `/`) add nav noise. Extract styles to `app.css`; drop or clearly mark demo pages.
  - *AC:* No dead nav noise; dashboard styles in CSS.

- [x] **OBJ-12** Service-worker versioning. (DONE — CACHE_VERSION constant) `service-worker.js:2` `CACHE_NAME` is a hardcoded
      magic string; no client posts `skipWaiting`. Move version to a constant / message-passed
      value; ensure update path (OBJ-03) posts `skipWaiting`.
  - *AC:* Version not a literal; update flow coherent.

- [x] **OBJ-13** Test hygiene + regression coverage. (DONE — xUnit1031 fixed; 5 interop-contract tests; suite 35→42 green)
  - *Verify:* Prior audit claimed xUnit1031 (blocking `.Result`/`.Wait`) in
    `InstallPromptServiceTests.cs:96`; current build shows 0 warnings — may already be fixed
    post-refactor. Confirm; if present, make the test async + await.
  - *Add:* Interop-contract regression tests for OBJ-01/02/03 (geolocation parse,
    `storage.clear` scoping, `sw.update` definition) so the contract drift cannot silently return.
  - *AC:* 0 xUnit1031; new interop-contract tests green; suite > 35.

---

## 3. Execution order (phased)

Phase A — HIGH (user-facing breakage): OBJ-01, OBJ-02, OBJ-03, OBJ-04.
Phase B — MED (dead paths / leaks): OBJ-05, OBJ-06 (needs user decision), OBJ-07, OBJ-08.
Phase C — LOW (polish): OBJ-09, OBJ-10, OBJ-11, OBJ-12.
Phase D — Verification & tests: OBJ-13, full build + `dotnet test`, manual browser smoke.

Each objective implemented via the surgical-orchestration Worker+Verifier loop
(per-directory scope, max 2 concurrent, SHA-256 debrief hash). Risky items
(OBJ-05 Convex DI, OBJ-07 interop eval removal) go through REVIEW gate.

## 4. Decisions required from user (blockers before Phase B/C)

1. OBJ-06: ship real video assets, or downgrade to SVG splash + remove dead `<video>`?
2. OBJ-08: strip all 9 unused settings fields, or wire specific ones (which?)?
3. Convex (OBJ-05): is a live backend expected now, or keep mock-only and just make
   the URL non-misleading (hide the control until backend exists)?

## 5. Verification plan (gate before COMPLETE)

- `dotnet build src/Mathilda -c Release` → 0 errors / 0 warnings.
- `dotnet test tests/Mathilda -c Release` → all green, suite > 35 (OBJ-13 added).
- New interop-contract tests cover OBJ-01/02/03.
- Manual browser smoke (Chromium): GPS resolves → weather/attractions update; Clear
  Cache succeeds; Force SW Reload triggers update; Install "Don't show again" persists.
- SECURITY_AUDIT: confirm no secrets/credentials exposed during OBJ-07 de-leak; no
  injection via interop changes.

## 6. Definition of Done

All HIGH objectives implemented + verified; MED implemented or explicitly deferred by
user decision; LOW addressed or ticketed; build/tests green; debrief accurate; no
unaddressed CRITICAL in code-review. Status assigned by FINAL_AUDIT with evidence
(READY / READY WITH WARNINGS / NOT READY / BLOCKED).

---

*Source inputs:* Pasted agent report (this session) + `docs/.scratch-audit/REFACTOR-AUDIT.md`.
*Corrections to prior audit:* interop path is `src/Mathilda/wwwroot/js/interop.js`;
`AppSettings.Currency` (not `TripCostEntry.Currency`) is the unused field; current build
is 0-warning/35-test (audit's xUnit1031 may already be resolved — see OBJ-13).

---

## Reconciliation Update (2026-09-11)

Header claims branch `feature/pwa-install-startup-advanced-settings`. Verified:
working tree is on `main` @ `145787f`; that feature branch's content is merged.
All 13 objectives (OBJ-01..13) remain implemented and verified (43/43 green,
`dotnet build` 0W/0E). REVIEW-FINDINGS-2026-09-07 F1/F3/F4 are remediated in tree;
F2/F5/F6 are deferred (see `docs/.scratch-audit/TRACEABILITY.md`). Banner corrected;
code state is authoritative.
