# AI Coding Rules & Architectural Invariants

## Strict Scope & "Do Not Touch" Zone

1. **Target Scope Only**: Edits must be strictly confined to the requested app directory (e.g., `src/pms-app/`).
2. **Protected Files**: NEVER touch `svelte.config.js`, `vite.config.ts`, `package.json`, `package-lock.json`, `release.sh`, or files under `src/lib/os/`, `src/lib/appShell/`, or other apps (`ocr-app`, `aps-app`) unless explicitly directed.

## Architectural Boundaries

1. **OS Layer vs App Layer**: Apps run inside the OS shell. Apps NEVER control OS shell chrome (MenuBar, TaskBar, AppShell).
2. **Authentication**: All operator login, session initiation (`beginOperatorSession`), credentials checking, and lockouts belong exclusively to `src/lib/os/Lockscreen.ioware.svelte`. Apps must never implement internal login screens (`MachineLogin.svelte`).
3. **No Cross-Layer Imports**: Never import app stores (`pmsStore`) into OS or flavor code (`src/lib/os/flavors/`).

## Design System & Component Reuse

1. Always search for and reuse primitives from `@ifactory/ui-v2` (`Button`, `Input`, `Label`, `Dialog`, `Keyboard`, etc.).
2. Reuse existing app components: `TimerDisplay`, `Stat`, `StatusBanner`, `ReasonSummaryCard`, `SectionHeading`, `JobHeader`.
3. Use brand design tokens: Primary `#FF6C2E`, error `#EF4444`, dark `#1B2028` / `#222222`, font families `Space Grotesk` and `Manrope`.

## Non-Destructive Refactoring & Hygiene

1. When redesigning screens, preserve all active functional logic: `setInterval` live timers, MQTT listeners, and navigation state.
2. Keep diffs minimal and clean. No unnecessary `<!-- svelte-ignore -->` insertions or whitespace churn.
3. Pre-completion validation: Verify `git diff --stat`, run `npm run check`, and `npm run lint`.
