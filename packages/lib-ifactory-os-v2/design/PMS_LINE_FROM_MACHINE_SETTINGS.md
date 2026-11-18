# PMS line from machineSettings

Status: **implemented** (angle, plate including `plate_manual`, and the manual card classes).

## Behaviour

One ioware PMS build. App visibility and line selection are separate:

### OS — app visibility (`visibility` on AppDefinition)

| App                | `visibility`                                                                    | Behaviour                                                                                  |
| ------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| WiFi / Device / IO | `always` (default)                                                              | Always in dock                                                                             |
| PMS                | `requiresAssetClass` + `supportedAssetClasses` (every class in `LINE_BY_CLASS`) | Dock + window when the primary class is in that map. A missing or unknown class hides PMS. |

- Gate is OS-owned: [`app-visibility.svelte.ts`](../src/lib/os/app-visibility.svelte.ts) reads KV `machineSettings` via [`extractPrimaryMachine`](../src/lib/os/asset-context.ts).
- Enforced only when `flavor.id === 'ioware'` (cloud/tests never hide apps).
- Auto-launch runs on **rising edge** of `hasAssetClass` only (periodic `/iow/machineSettings` echoes do not re-focus).
- Dock lists are `$derived` from readiness so icons appear without re-login.

### App — line hydrate (inside PMS)

1. `App.svelte` calls `bindPmsLine()` on mount
2. Read KV `machineSettings`; take the primary machine (`extractPrimaryMachine`)
3. **No settings / no `assetClass`** → Loading EmptyState (if window was opened manually)
4. When `assetClass` arrives:
   - `angle_cnc` → angle screens
   - `plate_cnc`, `plate_manual` → plate screens (`jobCard: plate`)
   - `angle_manual`, punching, drilling, notching, bending, bending furnace, stamping, band saw, heel cutting → manual screens
   - unknown class → PMS stays hidden (no blocked window)
5. Sync `aid` via `setSelectedAssetId` for `/iow/*` publishes
6. Re-resolve on `/iow/machineSettings` echoes

OS flavor does **not** import PMS stores. Apps opt in with `visibility: 'requiresAssetClass'`.

## Code

| File                                  | Role                                 |
| ------------------------------------- | ------------------------------------ |
| `src/lib/os/asset-context.ts`         | `extractPrimaryMachine`              |
| `src/lib/os/app-visibility.svelte.ts` | readiness + `isAppVisible`           |
| `src/pms-app/lib/line-from-class.ts`  | pure class → line map                |
| `src/pms-app/lines/registry.ts`       | angle, plate, and manual screen maps |
| `src/pms-app/lib/pms-line.svelte.ts`  | store + hydrate + MQTT bind          |
| `src/pms-app/routes/App.svelte`       | loading / blocked / active screens   |

## Follow-on

- Explicit `_shared.visibleApps` allowlist in machineSettings — not in this PR.
