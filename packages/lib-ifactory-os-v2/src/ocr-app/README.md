# OCR app

Standalone OS dock app for BOM drawing OCR.

## Browse flow

PM-like, view-only hierarchy under `#/OCR/…`:

Projects → Project → Tower Types / Stubs → Subtypes → Versions → Drawing sets → Drawing files

Only the drawing-files page has Generate / View. No create / edit / delete / upload in OCR.

Then: Mark Region → Results.

## Ownership

**All OCR flow UI and logic live here**, including:

- Mark Region / Results routes
- Hole review + mark edit dialogs (`BBoxReviewer`, etc.)
- OCR adapter (`ocr.backend`), types, constants, PoC API client
- Results session state, background extraction, CSV export

`project-management-app` is **not** modified for OCR. Remaining PM imports are only
generic project/BOM data helpers (`loadBomPageContext`, `boms.api` download/update)
until those are replaced with OCR-local loaders.

## Multi-drawing extract

A BOM version may have 1..N drawing PDFs. Mark Region builds

`{ op: 'extract', bom_id, rois: [{ drawing_file_id, roi }, …], regex? }`

for every selected file (including a single file). Legacy `{ roi }` is only sent when
file ids are unknown. Filmstrip pages are the first 5 **source** pages per file
(`drawing_file_id` + `source_page_number <= 5`). Draft ROIs persist on
`ocr_verification_drawings.roi`.

Results after Generate / View are scoped to the selected `drawingFileIds` in the
session stash. Other files' rows stay in the verification (subset extract keeps them)
but are hidden unless you open those files.

See `ifactoryai-core/docs/BOM_VERSIONING_AND_OCR_MULTIFILE.md` §2.2.
