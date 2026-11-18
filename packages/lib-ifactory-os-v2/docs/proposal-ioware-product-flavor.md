# Proposal: IoWare as a product flavor in `lib-ifactory-os-v2`

**Status:** In progress — Milestone 1 landed (flavor plugs + edge apps; OTA/cutover later)  
**Date:** 2026-09-10  
**Repos:** `jsl-ioware-os` → into `lib-ifactory-os-v2`

---

## What we want

Use **one git repo** (`lib-ifactory-os-v2`) for both:

1. **Cloud** — factory OS (today’s os-v2 web apps)
2. **IoWare** — device HMI OS (today’s `jsl-ioware-os`)

Same codebase, **two build-time flavors**, **two deploy tracks**.  
Device builds can also enable **selected web apps** alongside edge HMI apps.

### Milestone 1 (done in repo)

- `VITE_OS_FLAVOR=cloud|ioware` with scripts `dev:cloud` / `build:cloud` / `dev:ioware` / `build:ioware`
- One shared `lib/os/IFactoryOS` with flavor plugs (`$osFlavor` → `flavors/cloud|ioware`)
- Edge apps: `pms-app`, `io-app`, `wifi-app`, `device-app` + `osConfig.ioware.ts`
- Edge lockscreen, overlays, MQTT under `lib/os` (ioware plug bag only)
- Default remains **cloud**; `jsl-ioware-os` not retired yet

---

## Why

| Today                                     | After                                        |
| ----------------------------------------- | -------------------------------------------- |
| Two sibling OS repos; shell copied/forked | One repo, one shared `IFactoryOS`            |
| AppShell / OS fixes land twice            | Fix once                                     |
| Web apps only on the cloud SPA            | Same app can be opted into the device flavor |
| Separate PR trains for related work       | One place to develop                         |

We already share `@ifactory/ui-v2` and the same dock-app pattern (`IFactoryOS` + `osConfig`). There is **no** package dependency between the two OS repos today.

---

## How it works

### Flavors

| Flavor   | Ships                                                          | Deploy                      |
| -------- | -------------------------------------------------------------- | --------------------------- |
| `cloud`  | Web apps (APS, OCR, planning, …)                               | Docker static image → Caddy |
| `ioware` | Edge apps (PMS, IO, WiFi, Device) **+ any web apps we enable** | OTA tarball → device nginx  |

```json
"dev:cloud": "VITE_OS_FLAVOR=cloud vite dev",
"dev:ioware": "VITE_OS_FLAVOR=ioware vite dev",
"build:cloud": "VITE_OS_FLAVOR=cloud vite build",
"build:ioware": "VITE_OS_FLAVOR=ioware vite build"
```

### Apps = one catalog, flavor = allowlist

Apps live once in the repo. Each flavor’s `osConfig` lists which apps to register and build.

```
lib-ifactory-os-v2/
├── src/
│   ├── … web apps (existing)
│   ├── … edge apps (moved from jsl-ioware-os)
│   ├── routes/
│   │   ├── osConfig.cloud.ts
│   │   ├── osConfig.ioware.ts
│   │   └── +page.svelte
│   └── lib/os/                 # one shell + flavor plugins
├── Dockerfile.static           # cloud
├── release.sh                  # ioware OTA (moved)
└── ota-templates/              # ioware OTA (moved)
```

**Enabling a web app on device:** add it to `osConfig.ioware`, confirm that app can reach its backend from the device (network, auth, offline), and accept the OTA size cost.

### One shell (shared `IFactoryOS`)

One `IFactoryOS`. Flavor supplies plugins — not a transport switch:

| Shared                                 | Per flavor                                        |
| -------------------------------------- | ------------------------------------------------- |
| Desktop, TaskBar, AppShell             | App list (`osConfig`)                             |
| Window chrome via app `windowControls` | Lockscreen / auth / boot                          |
|                                        | `taskBar` config (tray, account action)           |
|                                        | Overlays (e.g. interlock, machine-idle on ioware) |

How an app talks to its backend (HTTP to datahub vs MQTT to the controller) stays inside that app or its flavor plugs. On device, edge apps and opted-in web apps can run in the **same SPA**.

---

## What moves

| Move into `lib-ifactory-os-v2`                               | Notes                   |
| ------------------------------------------------------------ | ----------------------- |
| `pms-app`, `io-app`, `wifi-app`, `device-app`                | From `jsl-ioware-os`    |
| Interlock, machine-idle, MQTT client                         | As ioware flavor plugs  |
| `release.sh`, `ota-templates/`, device nginx/supervisor bits | Device deploy track     |
| Edge deps (`mqtt`, `qrcode`, …)                              | Needed by ioware flavor |

Cloud Docker path stays as it is. After cutover: archive or remove `jsl-ioware-os`.

---

## Rollout

1. **Skeleton** — `osConfig.ioware`, `dev:ioware` / `build:ioware`, copy edge apps; do not retire `jsl-ioware-os` yet
2. **Shell** — unify on one `IFactoryOS` with flavor plugins; keep `build:cloud` green
3. **Dual deploy** — OTA scripts on `build:ioware`; Docker on `build:cloud`; CI for both
4. **Cutover** — point device installs at os-v2 ioware flavor; archive `jsl-ioware-os`

Web apps on device: opt in **after** edge apps work — per app, with a short connectivity/auth check.

---

## Risks

| Risk                                   | Mitigation                                       |
| -------------------------------------- | ------------------------------------------------ |
| Unused apps bloating a flavor build    | `osConfig` is the allowlist                      |
| Web app on device without network/auth | Checklist before each opt-in                     |
| Larger device OTA                      | Opt in deliberately; watch `build:ioware` size   |
| Cloud regressions while merging        | Keep cloud as default path until ioware is green |

---

## Alternatives (not chosen)

| Alternative                                             | Why not                                         |
| ------------------------------------------------------- | ----------------------------------------------- |
| Keep two OS repos                                       | Continues shell fork / double fixes             |
| Extract a published `@ifactory/os-v2` npm package first | More work than we need to start; can come later |
| Move cloud into `jsl-ioware-os`                         | Wrong home (OTA/edge-centric)                   |

---

## Open for review

1. Agree to host IoWare as a flavor in `lib-ifactory-os-v2`?
2. Start with Phase 1 (skeleton branch) without retiring `jsl-ioware-os`?
3. Which web apps (if any) are candidates to enable on device first?

---

## References

- IoWare MQTT gaps: `jsl-ioware-os/docs/mqtt-controller-gaps.md`
- Cloud ship: `lib-ifactory-os-v2/Dockerfile.static`
- IoWare OTA: `jsl-ioware-os/release.sh`, `jsl-ioware-os/ota-templates/`
- App registration today: `src/routes/osConfig.ts` in each repo
