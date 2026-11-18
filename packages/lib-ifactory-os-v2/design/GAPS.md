# Design / contract gaps — lib-ifactory-os-v2 (develop)

## PMS / HMI local MQTT (§5 — ifactoryai-core)

UI publish payloads on develop are aligned to ifactoryai-core
`docs/ingestion/PMS_UI_LOCAL_MQTT.md` field changes (§5):

| Topic / path                         | UI now sends                                                               |
| ------------------------------------ | -------------------------------------------------------------------------- |
| Path A `/rt/d2c` `14001` / `14002`   | full envelope `{ uuid, aid, eg, eid, ec, ts, pl }` with `oid` uuid + `sid` |
| Path A `/rt/d2c` `11003`             | via `publishClitCompleted` (+ local `/iow/clitCompleted`)                  |
| `/iow/operatorLoggedIn`              | `{ aid, oid, sid }` — `sid` uuid v7; KV `session.current`                  |
| `/iow/operatorLoggedOut`             | `{ aid, oid, sid }` + KV delete `session.current`                          |
| `/iow/startJob`                      | `{ aid, jobId, rmId, jobData }`                                            |
| `/iow/jobStopped`                    | `{ aid, alertCode }` (`publishJobStopped`)                                 |
| `/iow/jobResumed`                    | `{ aid, jobId }` (`publishJobResumed`)                                     |
| `/iow/reasonSelected`                | `{ aid, alertCode }`                                                       |
| `/iow/raiseAlert`                    | `{ aid, alertCode }`                                                       |
| `/iow/overlayAlert`                  | `{ aid, alertCode }` (+ `type: 'restoredAlert'` on restore)                |
| `/iow/closeBreakdownGroupTicket`     | `{ aid, alertCode? }` when a catalog reason is selected                    |
| `/iow/cancelJob`                     | `{ aid, jobId }` from `activeJob`                                          |
| `/iow/currentScreen` / `/iow/unlock` | `{ aid, … }`                                                               |
| `/iow/interlockStateChanged`         | `{ aid, enabled }`                                                         |
| other `/iow/*` device/wifi empties   | `{ aid }` (wifi payload fields unchanged + `aid`)                          |

`aid` comes from [`src/lib/os/asset-context.ts`](../src/lib/os/asset-context.ts): first non-`_shared` machine in `machineSettings` (reads `aid`, legacy `assetId` accepted when loading). Jobs load uses `jobs:<aid>` when resolved.

**Reason buttons** render `effective(machine).reasons` from `machineSettings` via
[`src/lib/os/reasons-catalog.svelte.ts`](../src/lib/os/reasons-catalog.svelte.ts)
(`_shared.reasons` ++ `_shared.reasonsByClass[assetClass]`; legacy `reasonsByType` still accepted).
Falls back to the hard-coded icon map in `$lib/stoppage-reasons` until settings load. System
reasons (`buttonNo: null`) stay in the catalog for `autoAlertSelected` lookup but are not shown
on the picker.

**Idle overlay** listens on `/rt/d2c` for `7001` / `7003` (and legacy eid `109`). It opens on the
next confirm/transition — same cadence as before (~`confirmIntervalS`, typically 60 s). Idle
auto-alert and job-stop `/iow/autoAlertSelected` use **`no_operator`**. Production alarms
(`/iow/productionWithNoOperator`, `/iow/productionWithNoJob`) open the same overlay with
**Change Reason hidden**; `/iow/productionAlarmCleared` closes it.

### Still open (follow-ups)

- **Multi-machine picker** — docs §6: session / selection should become per-machine (`session:<aid>`); UI currently picks the first machine.
- **CLIT checklist UI** — Path A/B helpers exist; no checklist screen wired yet.
- **PMS manual multi-machine picker** — `jsl-pms-app-manual` `MachinePanel` needs the OS shell bridge (`$lib/os/bridge/app-shell.svelte`), which this branch does not have. Manual classes open Start Job directly. `plate_manual` uses the plate screens.
- **Plate APS job cards** — Start Job stays empty until os-v2 builds `PL:<mark>` HMI cards for `publish_job` (core handoff); independent of line switching.
