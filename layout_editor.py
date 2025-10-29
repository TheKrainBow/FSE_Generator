import sys, fitz, yaml
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QListWidget, QPushButton, QFileDialog
)
from PyQt6.QtGui import QPixmap, QImage, QPainter, QPen, QColor, QFont
from PyQt6.QtCore import Qt, QTimer, QRectF


class LayoutEditor(QMainWindow):
    def __init__(self, pdf_path):
        super().__init__()
        self.setWindowTitle("PDF Layout Editor")
        self.pdf_path = pdf_path

        # Load PDF and first page
        self.doc = fitz.open(pdf_path)
        self.page = self.doc[0]

        # The logical fields user can position
        # preview_text is only for on-screen visualization
        self.fields = [
            {"id": "theme_origin",         "label": "Theme/Origin",                    "preview_text": "Atelier Sécurité"},
            {"id": "intitule",             "label": "Intitulé",                        "preview_text": "Initiation à la cybersécurité"},
            {"id": "fonds_concerne",       "label": "Fonds concerné",                  "preview_text": "FSE+ Région Sud"},
            {"id": "commentaire",          "label": "Commentaire",                     "preview_text": "Présence obligatoire.\nMerci de signer."},
            {"id": "duree_heures",         "label": "Durée (heures)",                  "preview_text": "3"},
            {"id": "duree_jours",          "label": "Durée (jours)",                   "preview_text": "1"},
            {"id": "matin_h1",             "label": "Matin: Part 1 (heure)",           "preview_text": "09"},
            {"id": "matin_m1",             "label": "Matin: Part 1 (minute)",          "preview_text": "00"},
            {"id": "matin_h2",             "label": "Matin: Part 2 (heure)",           "preview_text": "12"},
            {"id": "matin_m2",             "label": "Matin: Part 2 (minute)",          "preview_text": "00"},
            {"id": "aprem_h1",             "label": "Aprem: Part 1 (heure)",           "preview_text": "14"},
            {"id": "aprem_m1",             "label": "Aprem: Part 1 (minute)",          "preview_text": "00"},
            {"id": "aprem_h2",             "label": "Aprem: Part 2 (heure)",           "preview_text": "17"},
            {"id": "aprem_m2",             "label": "Aprem: Part 2 (minute)",          "preview_text": "00"},
            {"id": "premier_nom_etudiant", "label": "Premier nom d'Etudiant",          "preview_text": "DURAND Bob"},
            {"id": "nom_surveillant",      "label": "Nom du surveillant",              "preview_text": "DUPONT Jean"},
            {"id": "pagination",      "label": "Pagination",              "preview_text": "1/2"},
            {"id": "date",      "label": "Date",              "preview_text": "18/02/2025"},
        ]

        # Store normalized positions (percent coords, 0..1)
        # px / py = -1 means "not set yet"
        self.positions = {
            f["id"]: {"px": -1.0, "py": -1.0} for f in self.fields
        }

        self.selected_field_id = None

        # Resize debounce
        self.resize_timer = QTimer()
        self.resize_timer.setSingleShot(True)
        self.resize_timer.timeout.connect(self.refresh_pixmap)

        # Cached render state
        self.current_scale = 1.0
        self.current_pdfpix_qpixmap = None  # pixmap of PDF page only (no overlay)

        self.build_ui()

    # ---------------------------
    # UI setup
    # ---------------------------
    def build_ui(self):
        container = QWidget()
        main_layout = QHBoxLayout(container)

        # Left column: field list + save button
        left = QVBoxLayout()
        self.list = QListWidget()
        for f in self.fields:
            self.list.addItem(f["label"])
        self.list.currentTextChanged.connect(self.select_field_by_label)

        self.save_btn = QPushButton("Save Layout YAML")
        self.save_btn.clicked.connect(self.save_layout)

        left.addWidget(QLabel("Select field:"))
        left.addWidget(self.list)
        left.addWidget(self.save_btn)

        # Right: PDF preview display
        self.label = QLabel()
        self.label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.label.setScaledContents(False)
        self.label.mousePressEvent = self.mouse_click

        # Initial render
        self.refresh_pixmap()

        main_layout.addLayout(left, 1)
        main_layout.addWidget(self.label, 4)
        self.setCentralWidget(container)

    # ---------------------------
    # Map from list label -> field id
    # ---------------------------
    def select_field_by_label(self, chosen_label: str):
        for f in self.fields:
            if f["label"] == chosen_label:
                self.selected_field_id = f["id"]
                return
        self.selected_field_id = None

    # ---------------------------
    # Render the underlying PDF page into a pixmap
    # Returns (qpixmap, scale)
    #
    # scale links PDF "points" to on-screen pixels.
    # BUT now that we're switching to percentages, we only need
    # the resulting pixmap size to place overlay text.
    # ---------------------------
    def render_page_scaled(self):
        rect = self.page.rect  # in PDF points (1/72 inch)
        avail_w = max(self.width() - 200, 400)   # leave room for sidebar
        avail_h = max(self.height() - 100, 300)

        ratio_pdf = rect.width / rect.height
        ratio_win = avail_w / avail_h

        if ratio_pdf > ratio_win:
            scale = avail_w / rect.width
        else:
            scale = avail_h / rect.height

        # margin so page isn't glued to edges
        scale *= 0.95

        pix = self.page.get_pixmap(matrix=fitz.Matrix(scale, scale))
        qimg = QImage(
            pix.samples, pix.width, pix.height, pix.stride,
            QImage.Format.Format_RGB888
        )
        qpix = QPixmap.fromImage(qimg)
        return qpix, scale

    # ---------------------------
    # Where the PDF pixmap sits inside the QLabel (centered box)
    # Returns a QRectF describing that box in label coordinates.
    # ---------------------------
    def get_pixmap_draw_rect(self):
        lm_w = self.label.width()
        lm_h = self.label.height()
        if not self.current_pdfpix_qpixmap:
            return QRectF(0, 0, lm_w, lm_h)

        pm_w = self.current_pdfpix_qpixmap.width()
        pm_h = self.current_pdfpix_qpixmap.height()

        off_x = (lm_w - pm_w) / 2.0
        off_y = (lm_h - pm_h) / 2.0
        return QRectF(off_x, off_y, pm_w, pm_h)

    # ---------------------------
    # Build final pixmap with overlays
    #
    # We take the raw PDF pixmap (self.current_pdfpix_qpixmap) and
    # draw preview text for each placed field according to its
    # stored percentage position.
    # ---------------------------
    def build_overlay_pixmap(self):
        if not self.current_pdfpix_qpixmap:
            return None

        pm = QPixmap(self.current_pdfpix_qpixmap)
        painter = QPainter(pm)

        painter.setPen(QPen(QColor(255, 0, 0), 1))
        painter.setFont(QFont("Sans", 10))

        pm_w = pm.width()
        pm_h = pm.height()

        for f in self.fields:
            fid = f["id"]
            txt = f["preview_text"]
            pos = self.positions[fid]
            if pos["px"] < 0 or pos["py"] < 0:
                continue

            # compute pixel position from normalized %
            x_px = pos["px"] * pm_w
            y_px = pos["py"] * pm_h

            lines = txt.split("\n")
            for i, line in enumerate(lines):
                painter.drawText(int(x_px), int(y_px + i * 14), line)

            # crosshair
            painter.drawLine(int(x_px) - 3, int(y_px), int(x_px) + 3, int(y_px))
            painter.drawLine(int(x_px), int(y_px) - 3, int(x_px), int(y_px) + 3)

        painter.end()
        return pm

    # ---------------------------
    # Re-render PDF base, then overlay
    # ---------------------------
    def refresh_pixmap(self):
        base_qpix, scale = self.render_page_scaled()
        self.current_pdfpix_qpixmap = base_qpix
        self.current_scale = scale  # we still store but % logic doesn't need it directly

        final_qpix = self.build_overlay_pixmap()
        if final_qpix is None:
            final_qpix = base_qpix

        self.label.setPixmap(final_qpix)

    # ---------------------------
    # Debounced resize redraw
    # ---------------------------
    def resizeEvent(self, event):
        self.resize_timer.start(150)
        return super().resizeEvent(event)

    # ---------------------------
    # Handle click -> store normalized % coords
    #
    # Steps:
    # 1. Figure out where inside the QLabel the pixmap is drawn (draw_rect).
    # 2. Get click position relative to that draw_rect.
    # 3. Convert to % of pixmap width/height.
    # 4. Store into self.positions[field_id].
    # 5. Redraw overlay so text appears where you clicked.
    # ---------------------------
    def mouse_click(self, event):
        if self.selected_field_id is None:
            return
        if not self.current_pdfpix_qpixmap:
            return

        click_x = event.position().x()
        click_y = event.position().y()

        draw_rect = self.get_pixmap_draw_rect()

        # ignore clicks outside the actual drawn PDF
        if (click_x < draw_rect.left() or
            click_x > draw_rect.right() or
            click_y < draw_rect.top() or
            click_y > draw_rect.bottom()):
            return

        rel_x = click_x - draw_rect.left()
        rel_y = click_y - draw_rect.top()

        pm_w = self.current_pdfpix_qpixmap.width()
        pm_h = self.current_pdfpix_qpixmap.height()

        # normalize (0..1)
        px_norm = float(rel_x) / float(pm_w)
        py_norm = float(rel_y) / float(pm_h)

        # clamp just to be safe numerically
        if px_norm < 0:
            px_norm = 0
        if px_norm > 1:
            px_norm = 1
        if py_norm < 0:
            py_norm = 0
        if py_norm > 1:
            py_norm = 1

        self.positions[self.selected_field_id]["px"] = round(px_norm, 6)
        self.positions[self.selected_field_id]["py"] = round(py_norm, 6)

        self.statusBar().showMessage(
            f"{self.selected_field_id} -> ({px_norm:.3f}, {py_norm:.3f})"
        )

        # redraw so we see the preview text snapped in place
        self.refresh_pixmap()

    # ---------------------------
    # Save YAML layout
    #
    # We only save x_percent / y_percent for each field.
    # We do NOT save preview text anymore.
    # ---------------------------
    def save_layout(self):
        out_data = {}
        for f in self.fields:
            fid = f["id"]
            pos = self.positions[fid]
            out_data[fid] = {
                "x_percent": pos["px"],
                "y_percent": pos["py"],
            }

        out_path, _ = QFileDialog.getSaveFileName(
            self, "Save Layout", "layout.yml", "YAML files (*.yml)"
        )
        if out_path:
            with open(out_path, "w", encoding="utf-8") as fh:
                yaml.dump(out_data, fh, sort_keys=False, allow_unicode=True)
            self.statusBar().showMessage(f"Layout saved to {out_path}")


# ---------------------------
# main
# ---------------------------
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python layout_editor.py myfile.pdf")
        sys.exit(1)

    app = QApplication(sys.argv)
    w = LayoutEditor(sys.argv[1])
    w.showMaximized()
    sys.exit(app.exec())
