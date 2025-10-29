# FSE Generator / Générateur FSE

## 🇬🇧 Overview

This project automates attendance sheet generation for FSE forms.

It does two main things:
1. **Layout editor (Python GUI)** – lets you visually place all text zones on top of a scanned attendance sheet and produces a `layout.yml` with coordinates.
2. **PDF generator (Go)** – fills the sheet for all attendees and produces final, ready-to-print PDFs.

You can generate attendee lists from:
- the 42 Intra API (`event_id`), or
- a local CSV file (`csv_path`).

All positions are resolution-independent, so once you've mapped a form once, you can reuse it forever 👍


---

## 🇫🇷 Aperçu

Ce projet génère automatiquement des feuilles d’émargement (présence/signature) pour des événements de formation.

Il fait deux choses :
1. **Éditeur de layout (interface Python)** – permet de cliquer sur un scan PDF de la feuille et de placer chaque zone de texte. Il génère un `layout.yml`.
2. **Générateur PDF (programme Go)** – remplit la feuille pour chaque participant et génère des PDF finaux imprimables.

La liste des participants peut venir :
- de l’API Intra 42 (`event_id`), ou
- d’un CSV local (`csv_path`).

Toutes les coordonnées sont en pourcentage, donc le placement est indépendant de la résolution ou du scan du document.

---

## 🇬🇧 Requirements / Dependencies

### 1. Go
- Used to generate the final PDFs.
- You need a recent Go toolchain (1.20+ recommended).
- Go dependencies:
  - `github.com/jung-kurt/gofpdf`
  - `github.com/TheKrainBow/go-api`
  - `gopkg.in/yaml.v3`

### 2. Python
- Used for the interactive layout editor (`layout_editor.py`).
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

## 🇫🇷 Dépendances requises

### 1. Go
- Utilisé pour générer les PDF finaux.
- Nécessite Go 1.20+.
- Dépendances Go :
  - `github.com/jung-kurt/gofpdf`
  - `github.com/TheKrainBow/go-api`
  - `gopkg.in/yaml.v3`

### 2. Python
- Utilisé pour l’éditeur graphique (`layout_editor.py`).
- Nécessite Python 3.10+.
- Dépendances Python :
  - `PyQt6`
  - `PyMuPDF` (fitz)
  - `pyyaml`

Installation :
```bash
python3 -m pip install --user PyQt6 PyMuPDF pyyaml
```

---

## 🇬🇧 How the workflow works

1. **Scan your blank attendance sheet** as `EmptyFSE.pdf`.
2. **Run the Python layout editor**:
   ```bash
   python3 layout_editor.py EmptyFSE.pdf
   ```
   Click each field name, then click where it should appear on the form.
   Save → `layout.yml`.
3. **Create a config.yml** describing:
   - The input file, layout, and output folder.
   - Either a `csv_path` or a `42API` section + `event_id`.
   (See Configs/config.yml for an example)
4. **Generate the filled PDFs**:
   ```bash
   go run main.go config.yml
   ```
   PDFs are written to your `output_folder`.

---

## 🇫🇷 Utilisation complète

1. **Scannez la feuille d’émargement** → `EmptyFSE.pdf`
2. **Lancez l’éditeur Python :**
   ```bash
   python3 layout_editor.py EmptyFSE.pdf
   ```
   Sélectionnez chaque champ, cliquez sur sa position, puis enregistrez `layout.yml`.
3. **Créez un `config.yml`** :
   - Indiquez `event_id` ou `csv_path`
   - Ajoutez les horaires, intitulé, formateur, etc.
   (Voir Configs/config.yml pour un example)
4. **Générez les PDF :**
   ```bash
   go run main.go config.yml
   ```
   Les fichiers finaux seront dans `output_folder`.

---

## 🗂️ Required files / Fichiers nécessaires

| File | Description |
|------|--------------|
| `layout_editor.py` | Python GUI to define coordinates |
| `main.go` | PDF generator |
| `config.yml` | Configuration (data source, texts, paths) |
| `layout.yml` | Generated coordinates from Python tool |
| `EmptyFSE.pdf` / `.jpg` | Background attendance form |
| `.ttf` font | e.g., DejaVuSans.ttf for UTF‑8 text |
| `students.csv` *(optional)* | Two columns: `FirstName,LastName` |

---

## 🏁 TL;DR

1. Run `layout_editor.py` to define coordinates → `layout.yml`
2. Fill out `config.yml`
3. Run `go run main.go config.yml`
4. Output PDFs appear in `out/`

That’s it 🚀
