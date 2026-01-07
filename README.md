# FSE Generator

## Overview

This project automates attendance sheet generation for FSE forms.

It does two main things:
1. **PDF generator (Go)** – fills the sheet for all attendees and produces ready‑to‑print PDFs.
2. **Layout editor (Python GUI)** – draw text boxes on top of a scanned attendance sheet and save a `layout.yml` with box coordinates.

You can generate attendee lists from:
- the 42 Intra API (`event_id` or `exam_id`), or
- a local CSV file (`csv_path` or legacy `CSVPath`).

All positions are stored as percentages, so placement is resolution‑independent.

---

## Requirements / Dependencies

### Go
- Used to generate the final PDFs.
- Requires Go 1.20+.
- Go dependencies:
  - `github.com/jung-kurt/gofpdf`
  - `github.com/jung-kurt/gofpdf/contrib/gofpdi`
  - `github.com/TheKrainBow/go-api`
  - `gopkg.in/yaml.v3`

### Python (optional)
- Used only if you want to modify the page layout (`layout_editor.py`).
- Requires Python 3.10+.
- Python dependencies:
  - `PyQt6`
  - `PyMuPDF`
  - `pyyaml`

Install them:
```bash
python3 -m pip install --user PyQt6 PyMuPDF pyyaml
```

---

## Go Tool (most users)

### 1) Pick a config
Examples are in `configs/`:
- `configs/event_config-example.yml`
- `configs/exam_config-example.yml`
- `configs/csv_config-example.yml`

### 2) Fill the config
Common fields:
- `pdf_template_image`: background PDF/image
- `pageLayout`: path to your `layout.yml`
- `output_folder`: output directory
- `font`: font settings (`name`, `path`, `size`)
- `landscape`: true/false

Data source (choose one):
- **Event**: `event_id` + `42API` block
- **Exam**: `exam_id` + `42API` block
- **Custom**: `csv_path` (or legacy `CSVPath`)

Text fields (all optional; API defaults apply in event/exam):
- `theme_objet`, `intitule`, `fonds_concerne`
- `event_hour_duration`, `event_days_duration`
- `morning_start_at_hour`, `morning_start_at_minute`, `morning_end_at_hour`, `morning_end_at_minute`
- `afternoon_start_at_hour`, `afternoon_start_at_minute`, `afternoon_end_at_hour`, `afternoon_end_at_minute`
- `comment`, `teacher_first_name`, `teacher_last_name`, `date_string`

CSV formats supported:
- `FirstName,LastName`
- `Id;Login;Email;First name;Last name;Campus name;Cursus`

### 3) Run the generator
```bash
go run main.go configs/event_config-example.yml
```

Outputs:
- `sheet_XX.pdf` per page
- Combined PDF:
  - `event_{eventID}_{eventDate}.pdf`
  - `exam_{examID}_{examDate}.pdf`
  - `custom_{date_string}.pdf` or `custom.pdf`

### Using the prebuilt binaries

Linux (amd64):
```bash
./bin/fse_generator-linux-amd64 configs/event_config-example.yml
```

Linux (arm64):
```bash
./bin/fse_generator-linux-arm64 configs/event_config-example.yml
```

macOS (amd64):
```bash
./bin/fse_generator-macos-amd64 configs/event_config-example.yml
```

macOS (arm64):
```bash
./bin/fse_generator-macos-arm64 configs/event_config-example.yml
```

Windows (amd64):
```bat
bin\\fse_generator-windows-amd64.exe configs\\event_config-example.yml
```

Windows (arm64):
```bat
bin\\fse_generator-windows-arm64.exe configs\\event_config-example.yml
```

---

## Layout Editor (optional)

Use this only if you want to change the page layout.

### 1) Run the editor
```bash
python3 layout_editor.py EmptyFSE.pdf
```
Optional: preload an existing layout:
```bash
python3 layout_editor.py EmptyFSE.pdf layout.yml
```

### 2) Draw boxes
- Drag to create a box for each field.
- Click a box to select it; drag to move; drag edges/corners to resize.
- Saved `layout.yml` contains `x_percent`, `y_percent`, `w_percent`, `h_percent`.

### 3) Use the new layout
Point your config `pageLayout` to the saved `layout.yml`.

1. **Scan your blank attendance sheet** as `EmptyFSE.pdf`.
2. **Run the Python layout editor**:
   ```bash
   python3 layout_editor.py EmptyFSE.pdf
   ```
   Optional: preload an existing layout:
   ```bash
   python3 layout_editor.py EmptyFSE.pdf layout.yml
   ```
   Drag to draw boxes. You can move and resize existing boxes.
3. **Create a config file** describing:
   - The input source (`event_id`, `exam_id`, or `csv_path`/`CSVPath`)
   - Layout path, output folder, and texts
   - Background PDF/image and font
   Examples are in `configs/`.
4. **Generate the PDFs**:
   ```bash
   go run main.go configs/event_config-example.yml
   ```

Output is written to your `output_folder`, including:
- `sheet_XX.pdf` per page
- A combined PDF:
  - `event_{eventID}_{eventDate}.pdf`
  - `exam_{examID}_{examDate}.pdf`
  - `custom_{date_string}.pdf` or `custom.pdf`

---

## Data Sources

### Event mode
Config:
- `event_id` + `42API`

Behavior:
- Fetches event info from `/events/{event_id}` and attendees from `/events/{event_id}/events_users`.
- Fills date, duration, times, theme/comment defaults.
- Any fields set in config override the API data.

### Exam mode
Config:
- `exam_id` + `42API`

Behavior:
- Fetches exam info from `/exams/{exam_id}` and attendees from `/exams/{exam_id}/exams_users`.
- Same defaults as events, but no morning/afternoon split; the start time decides which side is used.
- Any fields set in config override the API data.

### Custom mode
Config:
- `csv_path` or legacy `CSVPath`

Behavior:
- Uses CSV only for the attendee list.
- All display fields come from the config; empty fields are not printed.

---

## Required Files

| File | Description |
|------|-------------|
| `layout_editor.py` | Python GUI to define box coordinates |
| `main.go` | PDF generator |
| `configs/*.yml` | Configuration examples |
| `layout.yml` | Generated box layout |
| `EmptyFSE.pdf` / `.jpg` | Background form |
| `.ttf` font | e.g., `DejaVuSans.ttf` for UTF‑8 text |
| `students.csv` *(optional)* | Attendee list |

---

## TL;DR

1. Fill out a config in `configs/`
2. Run `go run main.go configs/event_config-example.yml`
3. Output PDFs appear in `out/`
4. Use `layout_editor.py` only if you need to modify the layout
