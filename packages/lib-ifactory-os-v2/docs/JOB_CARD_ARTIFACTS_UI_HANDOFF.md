# Job card rev 2 on the HMI: drawings, QR, display data — handoff to the UI team (2026-10-09, v2)

What os-v2 (the APS publisher) and the HMI branches (`jsl-pms-app-{angle,plate,manual}`) have to
change so the operator sees the full job card and the drawings on the panel. The design, with the
reasons, is [`PMS_JOB_CARD_ARTIFACTS.md`](./PMS_JOB_CARD_ARTIFACTS.md); this page is only the
contract. Server side (core), the runtime and the controller are ours and are being built on core
branch `feat/job-card-artifacts`; nothing here waits on you to start.

**In one line:** the card you already publish gains four optional fields (`cardRev`, `qr`,
`display`, `artifacts`); core signs a download URL per drawing and the device fetches the images
itself; the HMI renders the card data and a new drawings view from local files. No image ever goes
through MQTT or through your publish call.

---

## 1. os-v2 — APS publisher (`src/aps-app/lib/job-cards.publish.ts`)

### 1.1 What to send

Everything you send today stays exactly as it is (the strict part: `section`/`sectionKgPerM`/`bars`
or `thicknessMm`/`marks` or `marks`, plus `scheduledAt`/`dueAt`). Add, per card step:

```jsonc
{
	// …the card as today…
	"cardRev": 2,
	"qr": "M-1441", // string ≤ 512 chars. Today: the job card number (jcSrNo). Evolves freely.
	"display": {
		// OPAQUE to the server: any JSON object ≤ 128 KB. Recommended keys below.
		"header": {
			"jcSrNo": "M-1441",
			"date": "2026-10-09",
			"customer": "…",
			"workOrder": "…",
			"batchNo": "…",
			"rmGrade": "…",
			"towerType": "…",
			"subtype": "…",
			"sets": 4,
			"projectName": "…"
		},
		"marks": [
			{
				"markNo": "J57 DA 2648",
				"lengthMm": 286,
				"widthMm": 174,
				"wtPerPieceKg": 28.53,
				"totalPcs": 24,
				"totalWtKg": 684.7,
				"holes": 6,
				"operation": "N B",
				"bundles": "4×6 + 1×2"
			}
		],
		"requisition": [
			{ "section": "ISA 75x75x6", "lengthMm": 12000, "quantity": 6, "weightKg": 489.6 }
		],
		"cuttingPlan": [
			{
				"rmId": "RM-…",
				"lengthMm": 12000,
				"quantity": 2,
				"markings": "A1×3, A2×2",
				"usedMm": 11890,
				"wasteMm": 110,
				"wastePct": 0.9,
				"weightKg": 81.6
			}
		],
		"schedule": [
			{
				"machine": "ANC-01",
				"plannedStart": "…",
				"plannedEnd": "…",
				"materialId": "RM-…",
				"lengthMm": 12000,
				"operation": "C",
				"qty": 2
			}
		]
	},
	"artifacts": [
		// ≤ 64 entries; one per (markNo, fileId); same fileId may repeat across marks
		{ "kind": "drawing", "markNo": "J57 DA 2648", "fileId": "<files.file_id uuid>", "page": 3 }
	]
}
```

- `display.*` is the web card's own row types (`JobCardDetail`: header strip, `rows`,
  `requisitionRows`, `cuttingRows`, `loadingRows`), 1:1. The server never reads inside `display`;
  the HMI renders the keys it knows and ignores the rest, so you can add keys without a core
  release. Keep the recommended names so the three HMI branches share one renderer.
- `display.marks`: send this STEP's lines (what the HMI card already filters to). If the plant
  wants the sibling steps' rows too, append them; the 128 KB cap is far above a 50-mark card.
- `artifacts[]`: from the `drawings[]` you already resolve for the web card
  (`ocr_results` → `ocr_pages.page_image_file_id`). Send **only `kind`, `markNo`, `fileId`
  (and `page` if you have it)**. Core fills `sha256`, `sizeBytes`, `mime` from the `files` row and
  stamps `url` + `expiresAt`. If you send `url`, `sha256`, `sizeBytes`, `expiresAt` they are
  overwritten, not rejected — same rule as `jobId`/`aid`.
- Images are the full-resolution OCR page images you show on the web today (~400 kB each).
  No derivative is needed from you for now.
- Caps (refused with `pms.job_card_too_large`): whole card ≤ 256 KB serialised, `display` ≤ 128 KB,
  `artifacts` ≤ 64, `qr` ≤ 512 chars.

### 1.2 New error codes from `POST /api/v2/datahub/pms/publish_job`

| code                            | meaning                                                          | what to show                                                                          |
| ------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `pms.job_card_too_large`        | a cap in §1.1                                                    | "card too large — reduce display rows"                                                |
| `pms.job_artifact_not_in_card`  | an `artifacts[].fileId` is not a drawing page of this card's BOM | "drawing <mark> does not belong to this card" — a bug in the lookup, not a user error |
| `pms.job_artifact_file_missing` | no `files` row for that id                                       | "drawing file missing"                                                                |

Everything else in the response (`items[]`, `okCount`, `failedCount`, the existing codes) is unchanged.

### 1.3 When to switch it on

**Not yet.** An OLD controller refuses a card with unknown fields at Start Job, so the order is
core → controller → runtime on every device of the plant, **then** os-v2 sends rev 2. We will tell
you when the plant is ready; until then build it behind a flag. Core accepts both rev 1 and rev 2
from its first release, so your branch can be tested against dev as soon as core is deployed there.

### 1.4 Nothing else in os-v2

OCR upload is untouched: the page images you upload already carry `files.checksum` (sha256) and
`file_size_bytes`, which is what core uses. The HMI-sized rendition discussed earlier is deferred.

---

## 2. HMI branches (`jsl-pms-app-angle` / `-plate` / `-manual`)

### 2.1 Start Job sends the reference, not the card

Today: `/iow/startJob { aid, jobId, rmId|marking|bundleNo, jobData: <whole card> }`.
After: **`/iow/startJob { aid, jobId, rmId? | marking? | bundleNo? }`** — drop `jobData`. The
controller reads the card from `jobs:<aid>` itself. The controller will accept both shapes for one
release so you can ship in any order relative to it.

### 2.2 The PMS app renders the new card fields (read-only)

The card in `jobs:<aid>` may now carry `cardRev`, `qr`, `display`, `artifacts` (§1.1 shape, plus
the server-stamped fields on each artifact). Treat them all as optional; a rev-1 card has none.

- `qr` → a QR on the job screen: `QRCode.toCanvas(el, card.qr)` with the `qrcode` dependency the
  app already has (`src/io-app/routes/Home.svelte` does the same). No image travels.
- `display.header` → the job strip; `display.marks`, `display.requisition`, `display.cuttingPlan`,
  `display.schedule` → tables, same columns as the web card's tabs. Unknown keys: ignore.
- **Text nodes only.** Never put any `display` string through `{@html}`; it is data from the
  planner's card, not markup.
- `artifacts` is for the drawings view (§2.3). The PMS app does not load images.
- Do not keep a local copy of the list; re-read `jobs:<aid>` on change, as today.

### 2.3 New: prefetch in the shell, and a Drawings view (never loaded by the PMS app)

> **Revised 2026-10-09 (v2).** The first version of this section had the runtime keep a
> `jobArtifacts:<aid>` manifest. That is withdrawn: the runtime is now a generic file fetcher and
> **the HMI decides what to fetch and where**. If you started on v1, the rendering part is the
> same; what changes is where the state comes from.

**Prefetch (shell, always loaded).** You already subscribe to `jobs:<aid>` for each machine. For
every card that carries `artifacts[]`, publish one fetch per entry:

```jsonc
// publish /rt/files/fetch
{ "requestId": "<uuid>", "url": artifact.url, "sha256": artifact.sha256, "sizeBytes": artifact.sizeBytes,
  "dest": "jobs/<card.jobId>/<artifact.fileId>.<ext>" }     // ext: image/jpeg → jpg, image/png → png, image/webp → webp
```

The runtime downloads to that path under its root, verifies the sha, and answers:

```
sub /rt/files/result    { requestId, dest, status: "ready" | "failed", bytes?, error? }
sub /rt/files/changed   { dest, status: "pending" | "ready" | "failed" | "deleted", error? }   // every state change
pub /rt/files/status    { requestId, dest }  →  /rt/files/result { requestId, dest, status: "ready" | "pending" | "absent", bytes? }
```

Fetch is idempotent: a `dest` that already holds that sha answers `ready` at once. Keep no local
download state — the runtime is the state. `error` values: `bad_dest`, `forbidden` (URL wrong or
expired, no retry), `sha_mismatch`, `size_mismatch`, `too_large`, `disk_full`, `io`.

**Drawings view.** Pick a job (from `jobs:<aid>`), list its marks (`card.artifacts[]` → `markNo`),
and show `<img src="http://localhost/artifacts/jobs/<jobId>/<fileId>.<ext>">` when the file is
`ready` (ask `/rt/files/status` per file on open, then follow `/rt/files/changed`). Otherwise:

| state                                                | show                                               | and                                                           |
| ---------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| `pending`                                            | "downloading…"                                     | —                                                             |
| `absent`                                             | "downloading…"                                     | re-publish the fetch (e.g. the kiosk restarted before it ran) |
| `failed: forbidden`, or `artifact.expiresAt` is past | "drawing link expired — ask planning to republish" | do not fetch                                                  |
| `failed: disk_full`                                  | "device storage full"                              | retry on next open                                            |
| other `failed`                                       | "drawing not available"                            | retry on next open                                            |

A mark may share a file with another mark (same sheet) — key by `fileId`. Pinch-zoom; images are
3600 px wide. Use `<img>`; do not fetch bytes in the renderer and do not cache beyond the page.

**Never delete.** The controller removes `jobs/<jobId>` when the job leaves `jobs:<aid>`, and
sweeps orphans. `artifacts[].url` is used for exactly one thing — the `fetch` payload. Never
display it, log it or put it in a screenshot.

---

## 3. Runtime + controller (ours — listed so the sequencing is visible)

- **controller**: re-vendor the card schema; read the card from the KV on `/iow/startJob`
  (accept `jobData` for one release); stop copying the card into `partialJobs:<aid>`.
- **runtime**: generic `/rt/files/{fetch,delete,status}` + `/changed`, root `/home/rs/data/artifacts`,
  nginx `/artifacts/` location (localhost only), factory-reset wipe. Knows nothing about jobs.
- **controller** (also): `/rt/files/delete { dest: "jobs/<jobId>" }` when it deletes a job; orphan
  sweep at boot and hourly.

Rollout: core → controller → runtime → os-v2 rev 2 → HMI (HMI §2.1 can go earlier). Questions:
server contract, us; `PMS_UI_LOCAL_MQTT.md` stays the HMI ↔ controller reference and will get the
§2 additions when the controller lands.
