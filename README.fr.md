# FSE Generator

## Aperçu

Ce projet automatise la génération de feuilles d’émargement FSE.

Il fait deux choses :
1. **Générateur PDF (Go)** – remplit la feuille pour chaque participant et produit des PDFs prêts à imprimer.
2. **Éditeur de layout (GUI Python)** – permet de tracer des boîtes de texte sur un scan et d’enregistrer un `layout.yml` avec les coordonnées.

La liste des participants peut venir :
- de l’API 42 Intra (`event_id` ou `exam_id`), ou
- d’un CSV local (`csv_path` ou l’ancien `CSVPath`).

Toutes les positions sont en pourcentage, donc indépendantes de la résolution.

---

## Dépendances

### Go
- Utilisé pour générer les PDFs.
- Nécessite Go 1.20+.
- Dépendances Go :
  - `github.com/jung-kurt/gofpdf`
  - `github.com/jung-kurt/gofpdf/contrib/gofpdi`
  - `github.com/TheKrainBow/go-api`
  - `gopkg.in/yaml.v3`

### Python (optionnel)
- Utilisé uniquement si vous voulez modifier la mise en page (`layout_editor.py`).
- Nécessite Python 3.10+.
- Dépendances Python :
  - `PyQt6`
  - `PyMuPDF`
  - `pyyaml`

Installation :
```bash
python3 -m pip install --user PyQt6 PyMuPDF pyyaml
```

---

## Outil Go (la plupart des utilisateurs)

### 1) Choisir un config
Exemples dans `configs/` :
- `configs/event_config-example.yml`
- `configs/exam_config-example.yml`
- `configs/csv_config-example.yml`

### 2) Remplir le config
Champs communs :
- `pdf_template_image` : fond PDF/image
- `pageLayout` : chemin vers `layout.yml`
- `output_folder` : dossier de sortie
- `font` : paramètres police (`name`, `path`, `size`)
- `landscape` : true/false

Source des données (choisissez une seule) :
- **Event** : `event_id` + bloc `42API`
- **Exam** : `exam_id` + bloc `42API`
- **Custom** : `csv_path` (ou ancien `CSVPath`)

Champs de texte (optionnels ; l’API remplit par défaut en event/exam) :
- `theme_objet`, `intitule`, `fonds_concerne`
- `event_hour_duration`, `event_days_duration`
- `morning_start_at_hour`, `morning_start_at_minute`, `morning_end_at_hour`, `morning_end_at_minute`
- `afternoon_start_at_hour`, `afternoon_start_at_minute`, `afternoon_end_at_hour`, `afternoon_end_at_minute`
- `comment`, `teacher_first_name`, `teacher_last_name`, `date_string`

Formats CSV supportés :
- `FirstName,LastName`
- `Id;Login;Email;First name;Last name;Campus name;Cursus`

### 3) Lancer le générateur
```bash
go run main.go configs/event_config-example.yml
```

Sorties :
- `sheet_XX.pdf` par page
- PDF combiné :
  - `event_{eventID}_{eventDate}.pdf`
  - `exam_{examID}_{examDate}.pdf`
  - `custom_{date_string}.pdf` ou `custom.pdf`

### Utiliser les binaires précompilés

Linux (amd64) :
```bash
./bin/fse_generator-linux-amd64 configs/event_config-example.yml
```

Linux (arm64) :
```bash
./bin/fse_generator-linux-arm64 configs/event_config-example.yml
```

macOS (amd64) :
```bash
./bin/fse_generator-macos-amd64 configs/event_config-example.yml
```

macOS (arm64) :
```bash
./bin/fse_generator-macos-arm64 configs/event_config-example.yml
```

Windows (amd64) :
```bat
bin\\fse_generator-windows-amd64.exe configs\\event_config-example.yml
```

Windows (arm64) :
```bat
bin\\fse_generator-windows-arm64.exe configs\\event_config-example.yml
```

---

## Éditeur de layout (optionnel)

À utiliser uniquement si vous voulez modifier la mise en page.

### 1) Lancer l’éditeur
```bash
python3 layout_editor.py EmptyFSE.pdf
```
Optionnel : précharger un layout existant :
```bash
python3 layout_editor.py EmptyFSE.pdf layout.yml
```

### 2) Dessiner les boîtes
- Glissez pour créer une boîte pour chaque champ.
- Cliquez pour sélectionner ; glissez pour déplacer ; redimensionnez par les bords/coins.
- Le `layout.yml` contient `x_percent`, `y_percent`, `w_percent`, `h_percent`.

### 3) Utiliser le nouveau layout
Mettez à jour `pageLayout` dans votre config.

---

## Sources de données

### Mode event
Config :
- `event_id` + `42API`

Comportement :
- Récupère l’event via `/events/{event_id}` et les participants via `/events/{event_id}/events_users`.
- Remplit automatiquement date, durées, horaires, thème/commentaire.
- Tout champ défini dans la config écrase les données API.

### Mode exam
Config :
- `exam_id` + `42API`

Comportement :
- Récupère l’exam via `/exams/{exam_id}` et les participants via `/exams/{exam_id}/exams_users`.
- Même logique que l’event, mais sans découpe matin/après‑midi : l’horaire de début détermine la zone.
- Tout champ défini dans la config écrase les données API.

### Mode custom
Config :
- `csv_path` ou ancien `CSVPath`

Comportement :
- Utilise uniquement le CSV pour la liste des participants.
- Tous les champs d’affichage viennent de la config ; les champs vides ne sont pas imprimés.

---

## Fichiers requis

| Fichier | Description |
|---------|-------------|
| `layout_editor.py` | GUI Python pour définir les boîtes |
| `main.go` | Générateur PDF |
| `configs/*.yml` | Exemples de configuration |
| `layout.yml` | Layout des boîtes |
| `EmptyFSE.pdf` / `.jpg` | Fond de feuille |
| Police `.ttf` | ex. `DejaVuSans.ttf` pour l’UTF‑8 |
| `students.csv` *(optionnel)* | Liste participants |

---

## TL;DR

1. Remplissez un config dans `configs/`
2. Exécutez `go run main.go configs/event_config-example.yml`
3. Les PDFs apparaissent dans `out/`
4. Utilisez `layout_editor.py` uniquement si vous devez modifier le layout
