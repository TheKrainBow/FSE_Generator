## FSE Generator

An internal tool for producing printable FSE (Feuille de Suivi d'Émargement) sheets. It lets you
prefill a participant list, control all shared event fields, preview the layout directly on top of a
PDF template and generate a ready-to-print PDF that respects the official format.

### Highlights
- CSV import plus native support for 42 Intra events/exams (via OAuth2 client credentials).
- Side-by-side editing experience: shared fields, participant list and live PDF preview stay in sync.
- Configurable pagination controls (extra blank pages, hide total pages) and signature column helpers
  that automatically cross unused cells.
- One-click browser printing that renders via `pdf-lib`, ensuring every field sits exactly inside the
  coordinates declared in `src/layout/pageLayout.ts`.
- Optional template override: drop a PDF next to `public/EmptyFSE.pdf` and point the UI to it.

---

## Getting started

### Requirements
- Node.js 20+ and npm 10+.
- Optional: 42 API credentials if you want event/exam prefill (create an OAuth app in intranet).

### Installation
```bash
npm install
```

### Development server
```bash
npm run dev
```
Vite hosts the app on `http://localhost:5173`. Participant updates, CSV imports, shared-field edits,
etc. re-render live inside the preview pane.

### Building for production
```bash
npm run build
```
Artifacts land in `dist/`. Serve with any static host or use the provided `Dockerfile`/
`docker-compose.yml` (`docker compose up --build`) to run it behind Nginx on port `4173`.

---

## Prefill options

### CSV import
1. Select **CSV** in the Prefill bar.
2. Upload a file with headers (at least Nom & Prénom columns).
3. Map the columns in the UI and import. Only non-empty rows are kept.

### 42 event/exam
1. Configure your credentials in `.env.local` (or `.env`) at the project root:
   ```ini
   VITE_FORTY_TWO_UID=xxxxx
   VITE_FORTY_TWO_SECRET=xxxxx
   VITE_FORTY_TWO_SCOPE=public
   VITE_FORTY_TWO_TOKEN_URL=https://api.intra.42.fr/oauth/token
   VITE_FORTY_TWO_API_BASE=https://api.intra.42.fr/v2
   ```
2. Select **Event** or **Exam**, enter the numeric ID and click **Prefill**.
3. The tool fetches the participant list plus best-effort defaults (durations, slots, comments).

Each prefill resets the form (you will be prompted if unsaved data exists). Use the **Reset to
empty** button to wipe everything manually.

---

## Shared fields & layout

- Shared fields live in `src/constants/fields.ts` and drive the UI form as well as field bindings to
  layout keys (see `SHARED_FIELD_BINDINGS`).
- The actual box coordinates reside in `src/layout/pageLayout.ts`. Every value is expressed as a
  percentage of the PDF page and is consumed both by the live preview and by the `pdf-lib` exporter.
- Participants are chunked via `src/lib/pages.ts` with 7 rows per page; extra blank pages ensure you
  can keep printing even if no participants are entered.
- The **empty page** option lets you add blank signature grids for last-minute attendees, while the
  *hide total pagination* toggle hides the `/total` part of `index/total`.
- To replace the PDF background, upload a file next to `public/EmptyFSE.pdf` and paste its relative
  path into the Template field inside the UI.

If you need to update the layout or create a new template, use the interactive helper located in
`layoutGenerator/`. Follow the quick guide in `layoutGenerator/README.md` to generate a YAML file of
percentage-based boxes, then copy the resulting values into `src/layout/pageLayout.ts`.

---

## Repository map

- `src/components/` – Prefill bar, shared-field forms, PDF previewer and printing controls.
- `src/lib/` – PDF rendering (`pdf.ts`), signature grid logic, name helpers, prefill builders.
- `src/layout/pageLayout.ts` – canonical bounding boxes for every field/signature column.
- `layoutGenerator/` – PyQt tool to visually adjust those boxes.
- `public/` – Default `EmptyFSE.pdf` template and embedded fonts.

---

## Layout generator companion

The Python helper living under `layoutGenerator/` allows you to drag-and-drop bounding boxes on top
of the official PDF. It outputs normalized coordinates that you can paste into `pageLayout.ts`.
See `layoutGenerator/README.md` for installation and usage details.
