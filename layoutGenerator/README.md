## Layout Generator

This folder contains a small PyQt application (`layout_editor.py`) that overlays bounding boxes on top
of your PDF template. It is the easiest way to update `src/layout/pageLayout.ts` after you tweak the
official FSE document.

### Requirements
- Python 3.10+
- Dependencies:
  ```bash
  pip install PyQt6 PyMuPDF PyYAML
  ```

### Usage
```bash
python layout_editor.py /path/to/template.pdf [existing-layout.yml]
```
- The PDF is rendered on the right, all logical fields live in the list on the left.
- Select a field, then click-and-drag inside the PDF to draw its bounding box. Drag edges/corners to
  refine placement; drag the box itself to move it.
- Use the **Save Layout YAML** button to export all boxes. The file stores percentages of the page
  width/height (`x_percent`, `y_percent`, `w_percent`, `h_percent`) so it works with any DPI and page
  size.
- Open an existing YAML as the optional second argument if you want to load the current layout and
  adjust only a few fields.

### From YAML to TypeScript
1. Save your layout (for instance `layout.yml`).
2. Copy the percentages into the corresponding entries in `src/layout/pageLayout.ts`.
3. Commit both the updated layout and the template PDF (if it changed).

The preview texts inside the tool only help with alignment; the actual values are injected at runtime
by the React app when it generates the PDF and when it renders the live preview.
