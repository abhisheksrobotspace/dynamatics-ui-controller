# AI Assisted Development Guidelines & Boundary Rules

**Repository:** `lib-ifactory-os-v2`  
**Purpose:** Prevent architectural erosion, cross-contamination, unnecessary diffs, and merge conflicts during AI-assisted ("wipe coding") development.

---

## 1. Context: What Happened in PR #163 & Why It Broke

In PR #163 (`feat-plate-app`), an AI assistant implemented frontend plate changes but caused severe regressions and architectural violations:

1. **Reinvented Authentication Inside an App:** Recreated an in-app `MachineLogin.svelte` page in `src/pms-app/` instead of using the existing OS Lockscreen (`src/lib/os/Lockscreen.ioware.svelte`).
2. **Hacked OS Shell Chrome:** Modified `AppShell.svelte`, `Desktop.svelte`, `index.svelte.ts`, and `app.svelte.ts` to add `showTopbar` / `isTopbarVisible` toggles just to hide the MenuBar during in-app login.
3. **Cross-Layer Import Pollution:** Imported `pmsStore` from an individual app into the core OS flavor definition (`src/lib/os/flavors/ioware.ts`).
4. **Modified Core Build Configurations:** Moved `adapter-static` and runes compiler options from `vite.config.ts` into `svelte.config.js` and altered proxy timeouts, breaking upstream parity with `develop`.
5. **Accidental File Edits:** Added arbitrary `<!-- svelte-ignore -->` comments into completely unrelated applications (`src/ocr-app/...`).
6. **Merge Conflicts:** Touching shared core files resulted in immediate merge conflicts when merging into or syncing with `develop`.

---

## 2. Core Architectural Principles

```mermaid
graph TD
    subgraph OS Shell Layer ["OS Shell Layer (src/lib/os/, src/lib/appShell/)"]
        IFactoryOS["IFactoryOS.svelte (Main Shell)"]
        MenuBar["MenuBar / AppShell Chrome"]
        Lockscreen["Lockscreen.ioware.svelte / Lockscreen.svelte"]
        TaskBar["TaskBar / Dock"]
    end

    subgraph Flavor Plugins ["Flavor Layer (src/lib/os/flavors/)"]
        ioware["ioware.ts (Device HMI)"]
        cloud["cloud.ts (Web Portal)"]
    end

    subgraph App Layer ["App Layer (src/<app-name>/)"]
        PMS["PMS App (src/pms-app/)"]
        APS["APS App (src/aps-app/)"]
        OCR["OCR App (src/ocr-app/)"]
    end

    Flavor Plugins -->|Plugs into| OS Shell Layer
    OS Shell Layer -->|Hosts in sandboxed window| App Layer
```

- **Rule of One-Way Flow:** Apps run inside the OS Shell. Apps **never** control, toggle, or alter OS Shell chrome or OS flavor definitions.
- **Authentication Belongs to OS:** Login, session creation (`beginOperatorSession`), credentials verification, and operator switching are handled **exclusively** by the OS Lockscreen. Apps open directly into operational screens (e.g., `StartJob`).
- **Isolation:** Each app in `src/<app-name>` is completely self-contained. An edit to `src/pms-app/` must NEVER touch `src/ocr-app/` or `src/lib/os/`.

---

## 3. Strict "Do Not Touch" (Protected Files)

Unless the prompt **explicitly instructs** modifying these files, the AI must NEVER edit:

- **Build & Framework Configs:**
  - `svelte.config.js`
  - `vite.config.ts`
  - `tsconfig.json`
  - `package.json` / `package-lock.json`
  - `.lintstagedrc.json` / `commitlint.config.js`
- **Core OS Shell Architecture:**
  - `src/lib/appShell/AppShell.svelte`
  - `src/lib/os/Desktop.svelte`
  - `src/lib/os/IFactoryOS.svelte`
  - `src/lib/os/TaskBar.svelte`
  - `src/lib/os/index.svelte.ts`
  - `src/lib/os/flavors/types.ts`
- **Infrastructure & Deployment:**
  - `release.sh`
  - `Dockerfile*`
  - `resources/*`
  - `ota-templates/*`
- **Unrelated Applications:**
  - If developing in `src/pms-app/`, all files outside `src/pms-app/` are strictly read-only.

---

## 4. Component Reuse & Design System Standards

Before writing custom markup or styles, AI must first inspect and reuse existing components:

| Category            | Source / Location                          | Examples                                                                                                                             |
| :------------------ | :----------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------- |
| **Primitives**      | `@ifactory/ui-v2`                          | `Button`, `Input`, `Label`, `Dialog`, `Keyboard`, `Tabs`, `Table`                                                                    |
| **Icons**           | `@lucide/svelte`                           | `Check`, `TriangleAlert`, `RefreshCw`, `Eye`, `EyeOff`                                                                               |
| **Shared Layouts**  | `src/pms-app/components/`                  | `TimerDisplay.svelte`, `Stat.svelte`, `StatusBanner.svelte`, `ReasonSummaryCard.svelte`, `SectionHeading.svelte`, `JobHeader.svelte` |
| **Meters & Gauges** | `@ifactory/ui-v2` or `src/lib/components/` | `ProgressMeter.svelte`, `NetworkStatusIcon.svelte`                                                                                   |

### Styling & Brand Guidelines:

- **Primary Action / Accent:** `#FF6C2E` (Orange)
- **Error / Danger:** `#EF4444` / `status-error`
- **Dark Text / Backgrounds:** `#1B2028` / `#222222`
- **Light Neutrals:** `#FAFAFA`, `#E4E6E8`, `bg-status-offline-bg`
- **Typography:** `Space Grotesk` for numbers/headings/badges; `Manrope` for labels/body text.

---

## 5. Non-Destructive "Wipe Coding" Rules

"Wipe coding" (replacing an entire screen component to match a new design) is permitted **ONLY** when respecting the following invariants:

1. **Preserve Business Logic & Timers:**
   - Retain all `setInterval` / timers (e.g. stopped live duration, auto-navigate timeouts, uptime/downtime counters).
   - Retain MQTT subscription handlers and state store updates.
2. **Preserve Navigation & Query Context:**
   - Retain parameters passed to `navigation.navigateTo(...)` or prefilled state (`startJobPrefillJobId`).
3. **No Phantom Code / Linter Edits:**
   - Do not add `<!-- svelte-ignore -->` comments to files that were not requested to change.
   - Do not reformat unchanged lines or apply conflicting prettier rules.

---

## 6. Pre-Completion Quality Checklist

Before committing or submitting changes:

```bash
# 1. Verify blast radius (Check that ONLY expected files were touched)
git status
git diff --stat

# 2. Check SvelteKit types & compilation
npm run check

# 3. Check code formatting & linting
npm run lint
```

---

## 7. Ready-to-Use AI Prompt Template (Copy & Paste to AI)

When prompting Cursor Composer, Claude, or any AI assistant for new features or fixes, copy and paste this header block at the beginning of your prompt:

```markdown
### 🛡️ OPERATIONAL GUARDRAILS (STRICT COMPLIANCE MANDATORY)

1. **Target Scope Only**: You are only allowed to modify files inside `src/<target-app-directory>/`.
2. **DO NOT TOUCH**: Do NOT edit `svelte.config.js`, `vite.config.ts`, `package.json`, or any files in `src/lib/os/`, `src/lib/appShell/`, or unrelated apps.
3. **Architecture Invariant**: Never implement authentication or login screens inside the app. Authentication is handled exclusively by the OS Lockscreen. Never hide or toggle the OS topbar/menubar.
4. **Component Reuse**: Prioritize using `@ifactory/ui-v2` and existing shared components (`TimerDisplay`, `Stat`, `StatusBanner`, `ReasonSummaryCard`, etc.).
5. **Logic Preservation**: Do not delete existing timers, intervals, state handlers, or navigation hooks when refactoring UI screens.
6. **Diff Hygiene**: Keep diffs minimal and surgical. No formatting changes in untouched files.
```
