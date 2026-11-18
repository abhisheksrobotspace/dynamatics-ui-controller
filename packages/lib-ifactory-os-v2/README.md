# `@ifactory/os-v2`

Factory OS SPA for **cloud** (web apps) and **IoWare** (device HMI). One repo, one shared `IFactoryOS` shell, two build-time flavors.

| Flavor            | Purpose        | Apps (allowlist)                              |
| ----------------- | -------------- | --------------------------------------------- |
| `cloud` (default) | Factory web OS | Existing web apps (`osConfig.ts`)             |
| `ioware`          | Device HMI     | PMS, IO, Wi‑Fi, Device (`osConfig.ioware.ts`) |

Flavor is selected with `VITE_OS_FLAVOR` and resolved via the `$osFlavor` alias (`src/lib/os/flavors/cloud|ioware.ts`).

Design notes: [`docs/proposal-ioware-product-flavor.md`](docs/proposal-ioware-product-flavor.md).

## Setup

```sh
npm install
```

## Develop

```sh
# Cloud (default if unset)
npm run dev:cloud

# IoWare device HMI
npm run dev:ioware
```

`npm run dev` runs Vite without forcing a flavor (defaults to **cloud**).

## Build

```sh
npm run build:cloud
npm run build:ioware
```

Preview a production build with `npm run preview`.

## Layout

```
src/
├── *-app/                 # Dock apps (cloud + ioware)
├── routes/
│   ├── osConfig.ts        # Cloud app allowlist
│   ├── osConfig.ioware.ts # IoWare app allowlist
│   └── +page.svelte
└── lib/os/                # Shared shell + flavor plugs
    └── flavors/
        ├── cloud.ts
        └── ioware.ts
```

UI components come from `@ifactory/ui-v2` (`lib-ifactory-ui-v2`).

## Checks

```sh
npm run check
npm run lint
npm test
```

## Status

Milestone 1 (flavor plugs + edge apps) is on `develop`. `jsl-ioware-os` is not retired yet — OTA/cutover is a later step.
