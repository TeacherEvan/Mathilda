# Mathilda

C# Blazor WebAssembly rebuild of the Flutter "Quicky" Thailand-travel utility.

- **Front-end:** Blazor WebAssembly (.NET 8, C#) — compiles to static WASM, hosted on Vercel.
- **Data layer:** [Convex](https://convex.dev) (reactive DB), reached from C# via the Convex HTTP API (no C# SDK).
- **CI:** GitHub Actions builds and tests on every push (`dotnet build` + `dotnet test`).

## Run locally
```
dotnet run --project src/Mathilda/Mathilda.csproj
```

## Deploy
- Vercel: imports this repo, runs `dotnet publish` and serves `publish/wwwroot` statically.
- Convex: `npx convex dev` (needs `CONVEX_DEPLOY_KEY`). Set `CONVEX_DEPLOYMENT` as a Vercel env var.

## Status

**Status: v0.2.0 milestone complete on `main`; no release tag yet** (see [REVIEW-FINDINGS-2026-09-07.md](./REVIEW-FINDINGS-2026-09-07.md)). 

Implemented:
- Blazor WASM front-end with **modernized octagon dashboard** (status bar, animated SVG tiles, quick currency/weather chips, install banner) + 8 feature pages (Attractions, Weather, Cost, Banking, Bathroom, Bolt, Counter, Location) + Settings/Splash.
- Convex data layer (HTTP API): `ConvexClient`, `PlacesService`, `WeatherService` with mock fallback; **real user location via `LocationService`**.
- PWA: `manifest.json`, `service-worker.js`, `InstallPromptService` + `InstallWizardModal` (adaptive desktop/iOS).
- Startup intro (`StartupVideoIntro`, **SVG splash only** — the prior `webm`/`mp4` assets were removed in commit `d92411d` as orphans; the SVG path is the only honest render).
- Privacy: `PrivacyConsentService` + `PrivacyConsentModal`; location explainer + Thai-province fallback (`LocationPromptModal`).
- Advanced settings hub (`AppSettingsService`, `SettingsPage` General/Privacy/Advanced tabs, `AdvancedSettingsPanel`), Convex `settings` schema extended.

**Tests:** `dotnet test` → **42 passed** (models, services, components, interop contracts).
**Build:** `dotnet publish -c Release` → Vercel-ready `publish/wwwroot`.

## Plans & Docs

- [docs/plans/2026-08-14-csharp-rebuild.md](docs/plans/2026-08-14-csharp-rebuild.md) — C# rebuild plan (G1–G5 resolved, v0.1.0).
- [docs/plans/archive/2026-08-17-pwa-install-startup-onboarding-advanced-settings.md](docs/plans/archive/2026-08-17-pwa-install-startup-onboarding-advanced-settings.md) — archived: PWA/startup/privacy/advanced-settings plan (resolution note at §0).
- [docs/plans/2026-08-18-settings-privacy-refactor-PLAN.md](docs/plans/2026-08-18-settings-privacy-refactor-PLAN.md) — settings/privacy refactor audit & remediation (complete).
- [REVIEW-FINDINGS-2026-09-07.md](./REVIEW-FINDINGS-2026-09-07.md) — post-completion code review (1 HIGH, 1 MED, 1 LOW fixed inline; 4 follow-on items deferred).
- [convex/README.md](convex/README.md) — Convex schema + HTTP API wiring.
