import sys, fitz, yaml
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QListWidget, QPushButton, QFileDialog
)
from PyQt6.QtGui import QPixmap, QImage, QPainter, QPen, QColor, QFont, QBrush
from PyQt6.QtCore import Qt, QTimer, QRectF


class LayoutEditor(QMainWindow):
    def __init__(self, pdf_path, layout_path=None):
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
            {"id": "premier_nom_etudiant", "label": "Étudiants",                       "preview_text": "DURAND Bob"},
            {"id": "nom_surveillant",      "label": "Nom du surveillant",              "preview_text": "DUPONT Jean"},
            {"id": "pagination",      "label": "Pagination",              "preview_text": "1/2"},
            {"id": "date",      "label": "Date",              "preview_text": "18/02/2025"},
        ]

        # Store normalized box positions (percent coords, 0..1)
        # px / py / pw / ph = -1 means "not set yet"
        self.positions = {
            f["id"]: {"px": -1.0, "py": -1.0, "pw": -1.0, "ph": -1.0} for f in self.fields
        }

        self.selected_field_id = None
        self.drag_start = None
        self.drag_current = None
        self.drag_mode = None
        self.drag_anchor = None
        self.drag_original = None
        self.drag_edge = None
        self.field_index = {f["id"]: i for i, f in enumerate(self.fields)}

        # Resize debounce
        self.resize_timer = QTimer()
        self.resize_timer.setSingleShot(True)
        self.resize_timer.timeout.connect(self.refresh_pixmap)

        # Cached render state
        self.current_scale = 1.0
        self.current_pdfpix_qpixmap = None  # pixmap of PDF page only (no overlay)

        if layout_path:
            self.load_layout(layout_path)

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
        self.list.currentRowChanged.connect(self.select_field_by_index)

        self.save_btn = QPushButton("Save Layout YAML")
        self.save_btn.clicked.connect(self.save_layout)

        left.addWidget(QLabel("Select field:"))
        left.addWidget(self.list)
        left.addWidget(self.save_btn)

        # Right: PDF preview display
        self.label = QLabel()
        self.label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.label.setScaledContents(False)
        self.label.setMouseTracking(True)
        self.label.mousePressEvent = self.mouse_press
        self.label.mouseMoveEvent = self.mouse_move
        self.label.mouseReleaseEvent = self.mouse_release

        # Initial render
        self.refresh_pixmap()

        main_layout.addLayout(left, 1)
        main_layout.addWidget(self.label, 4)
        self.setCentralWidget(container)

    # ---------------------------
    # Load existing layout YAML
    # ---------------------------
    def load_layout(self, layout_path):
        try:
            with open(layout_path, "r", encoding="utf-8") as fh:
                data = yaml.safe_load(fh) or {}
        except Exception as exc:
            print(f"Failed to load layout: {exc}")
            return

        for f in self.fields:
            fid = f["id"]
            if fid not in data:
                continue
            entry = data.get(fid) or {}
            px = entry.get("x_percent", -1.0)
            py = entry.get("y_percent", -1.0)
            pw = entry.get("w_percent", -1.0)
            ph = entry.get("h_percent", -1.0)

            # Backward compat: old layouts only had a point, not a box.
            if pw < 0 or ph < 0:
                pw, ph = 0.05, 0.02

            self.positions[fid]["px"] = px
            self.positions[fid]["py"] = py
            self.positions[fid]["pw"] = pw
            self.positions[fid]["ph"] = ph

    # ---------------------------
    # Map from list row -> field id
    # ---------------------------
    def select_field_by_label(self, chosen_label: str):
        for idx, f in enumerate(self.fields):
            if f["label"] == chosen_label:
                self.list.setCurrentRow(idx)
                return
        self.selected_field_id = None
        self.refresh_pixmap()

    def select_field_by_index(self, row: int):
        if row < 0 or row >= len(self.fields):
            self.selected_field_id = None
        else:
            self.selected_field_id = self.fields[row]["id"]
        self.refresh_pixmap()

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
            if pos["px"] < 0 or pos["py"] < 0 or pos["pw"] < 0 or pos["ph"] < 0:
                continue

            # compute pixel position from normalized %
            x_px = pos["px"] * pm_w
            y_px = pos["py"] * pm_h
            w_px = pos["pw"] * pm_w
            h_px = pos["ph"] * pm_h

            if fid == self.selected_field_id:
                painter.setPen(QPen(QColor(0, 120, 255), 2))
            else:
                painter.setPen(QPen(QColor(255, 0, 0), 1))

            text_rect = QRectF(x_px, y_px, w_px, h_px)
            painter.save()
            painter.setClipRect(text_rect)
            if fid == "premier_nom_etudiant":
                rows = 7
                row_h = h_px / rows if rows > 0 else h_px
                for i in range(rows):
                    row_rect = QRectF(x_px, y_px + i * row_h, w_px, row_h)
                    painter.drawText(
                        row_rect,
                        Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter,
                        txt,
                    )
            else:
                if fid in ("nom_surveillant", "commentaire", "duree_heures", "duree_jours",
                           "matin_h1", "matin_m1", "matin_h2", "matin_m2",
                           "aprem_h1", "aprem_m1", "aprem_h2", "aprem_m2"):
                    align = Qt.AlignmentFlag.AlignCenter
                elif fid == "date":
                    align = Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter
                else:
                    align = Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter
                painter.drawText(
                    text_rect,
                    align | Qt.TextFlag.TextWordWrap,
                    txt,
                )
            painter.restore()

            # box outline
            painter.drawRect(int(x_px), int(y_px), int(w_px), int(h_px))

        # draw active drag box
        if self.drag_start and self.drag_current:
            pen = QPen(QColor(0, 120, 255), 1, Qt.PenStyle.DashLine)
            painter.setPen(pen)
            painter.setBrush(QBrush(QColor(0, 120, 255, 30)))
            x0, y0 = self.drag_start
            x1, y1 = self.drag_current
            left = min(x0, x1)
            top = min(y0, y1)
            width = abs(x1 - x0)
            height = abs(y1 - y0)
            painter.drawRect(QRectF(left, top, width, height))

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
    def clamp_to_draw_rect(self, x, y, draw_rect):
        x = max(draw_rect.left(), min(x, draw_rect.right()))
        y = max(draw_rect.top(), min(y, draw_rect.bottom()))
        return x, y

    def is_inside_draw_rect(self, x, y, draw_rect):
        return (x >= draw_rect.left() and x <= draw_rect.right() and
                y >= draw_rect.top() and y <= draw_rect.bottom())

    def get_box_pixels(self, fid):
        pos = self.positions[fid]
        if pos["px"] < 0 or pos["py"] < 0 or pos["pw"] < 0 or pos["ph"] < 0:
            return None
        pm_w = self.current_pdfpix_qpixmap.width()
        pm_h = self.current_pdfpix_qpixmap.height()
        x_px = pos["px"] * pm_w
        y_px = pos["py"] * pm_h
        w_px = pos["pw"] * pm_w
        h_px = pos["ph"] * pm_h
        return x_px, y_px, w_px, h_px

    def hit_test_edge(self, x, y, rect, tol=6):
        left, top, width, height = rect
        right = left + width
        bottom = top + height
        near_left = abs(x - left) <= tol
        near_right = abs(x - right) <= tol
        near_top = abs(y - top) <= tol
        near_bottom = abs(y - bottom) <= tol
        inside = (x >= left and x <= right and y >= top and y <= bottom)

        if near_left and near_top:
            return "nw"
        if near_right and near_top:
            return "ne"
        if near_left and near_bottom:
            return "sw"
        if near_right and near_bottom:
            return "se"
        if near_left and inside:
            return "w"
        if near_right and inside:
            return "e"
        if near_top and inside:
            return "n"
        if near_bottom and inside:
            return "s"
        if inside:
            return "move"
        return None

    def update_cursor(self, local_x, local_y):
        if not self.current_pdfpix_qpixmap:
            return
        fid = self.find_box_at(local_x, local_y)
        if not fid:
            self.label.setCursor(Qt.CursorShape.CrossCursor)
            return
        rect = self.get_box_pixels(fid)
        edge = self.hit_test_edge(local_x, local_y, rect)
        if edge == "move":
            self.label.setCursor(Qt.CursorShape.OpenHandCursor)
        elif edge in ("e", "w"):
            self.label.setCursor(Qt.CursorShape.SizeHorCursor)
        elif edge in ("n", "s"):
            self.label.setCursor(Qt.CursorShape.SizeVerCursor)
        elif edge in ("ne", "sw"):
            self.label.setCursor(Qt.CursorShape.SizeBDiagCursor)
        elif edge in ("nw", "se"):
            self.label.setCursor(Qt.CursorShape.SizeFDiagCursor)
        else:
            self.label.setCursor(Qt.CursorShape.CrossCursor)

    def find_box_at(self, x, y):
        for f in self.fields:
            fid = f["id"]
            rect = self.get_box_pixels(fid)
            if not rect:
                continue
            left, top, width, height = rect
            right = left + width
            bottom = top + height
            if x >= left and x <= right and y >= top and y <= bottom:
                return fid
        return None

    def select_field_by_id(self, fid):
        if fid not in self.field_index:
            return
        self.list.setCurrentRow(self.field_index[fid])

    # ---------------------------
    # Handle drag to define a box
    # ---------------------------
    def mouse_press(self, event):
        if not self.current_pdfpix_qpixmap:
            return

        click_x = event.position().x()
        click_y = event.position().y()

        draw_rect = self.get_pixmap_draw_rect()

        # ignore clicks outside the actual drawn PDF
        if not self.is_inside_draw_rect(click_x, click_y, draw_rect):
            return

        local_x = click_x - draw_rect.left()
        local_y = click_y - draw_rect.top()
        clicked_id = self.find_box_at(local_x, local_y)
        if clicked_id:
            self.select_field_by_id(clicked_id)
            rect = self.get_box_pixels(clicked_id)
            edge = self.hit_test_edge(local_x, local_y, rect)
            if edge:
                self.drag_mode = "resize" if edge != "move" else "move"
                self.drag_edge = edge
                self.drag_anchor = (local_x, local_y)
                self.drag_original = rect
                self.drag_start = (local_x, local_y)
                self.drag_current = (local_x, local_y)
                self.refresh_pixmap()
                return

        if self.selected_field_id is None:
            return

        self.drag_mode = "new"
        self.drag_start = (local_x, local_y)
        self.drag_current = self.drag_start
        self.refresh_pixmap()

    def mouse_move(self, event):
        if not self.drag_start or not self.current_pdfpix_qpixmap:
            if not self.current_pdfpix_qpixmap:
                return
            draw_rect = self.get_pixmap_draw_rect()
            move_x = event.position().x()
            move_y = event.position().y()
            if not self.is_inside_draw_rect(move_x, move_y, draw_rect):
                self.label.setCursor(Qt.CursorShape.ArrowCursor)
                return
            local_x = move_x - draw_rect.left()
            local_y = move_y - draw_rect.top()
            self.update_cursor(local_x, local_y)
            return
        draw_rect = self.get_pixmap_draw_rect()
        move_x = event.position().x()
        move_y = event.position().y()
        move_x, move_y = self.clamp_to_draw_rect(move_x, move_y, draw_rect)
        local_x = move_x - draw_rect.left()
        local_y = move_y - draw_rect.top()
        self.drag_current = (local_x, local_y)

        if self.drag_mode in ("move", "resize") and self.drag_original:
            pm_w = self.current_pdfpix_qpixmap.width()
            pm_h = self.current_pdfpix_qpixmap.height()
            x0, y0, w0, h0 = self.drag_original
            min_w = 4
            min_h = 4

            if self.drag_mode == "move":
                dx = local_x - self.drag_anchor[0]
                dy = local_y - self.drag_anchor[1]
                new_x = max(0, min(x0 + dx, pm_w - w0))
                new_y = max(0, min(y0 + dy, pm_h - h0))
                self.positions[self.selected_field_id]["px"] = round(new_x / pm_w, 6)
                self.positions[self.selected_field_id]["py"] = round(new_y / pm_h, 6)
                self.refresh_pixmap()
                return

            left, top, right, bottom = x0, y0, x0 + w0, y0 + h0
            if "w" in self.drag_edge:
                left = min(max(0, local_x), right - min_w)
            if "e" in self.drag_edge:
                right = max(min(pm_w, local_x), left + min_w)
            if "n" in self.drag_edge:
                top = min(max(0, local_y), bottom - min_h)
            if "s" in self.drag_edge:
                bottom = max(min(pm_h, local_y), top + min_h)

            new_w = right - left
            new_h = bottom - top
            self.positions[self.selected_field_id]["px"] = round(left / pm_w, 6)
            self.positions[self.selected_field_id]["py"] = round(top / pm_h, 6)
            self.positions[self.selected_field_id]["pw"] = round(new_w / pm_w, 6)
            self.positions[self.selected_field_id]["ph"] = round(new_h / pm_h, 6)
            self.refresh_pixmap()
            return
        self.refresh_pixmap()

    def mouse_release(self, event):
        if self.selected_field_id is None:
            return
        if not self.current_pdfpix_qpixmap or not self.drag_start or not self.drag_current:
            self.drag_start = None
            self.drag_current = None
            return

        if self.drag_mode in ("move", "resize"):
            self.drag_start = None
            self.drag_current = None
            self.drag_mode = None
            self.drag_anchor = None
            self.drag_original = None
            self.drag_edge = None
            self.refresh_pixmap()
            return

        draw_rect = self.get_pixmap_draw_rect()
        end_x = event.position().x()
        end_y = event.position().y()
        end_x, end_y = self.clamp_to_draw_rect(end_x, end_y, draw_rect)
        end_pos = (end_x - draw_rect.left(), end_y - draw_rect.top())

        x0, y0 = self.drag_start
        x1, y1 = end_pos
        left = min(x0, x1)
        top = min(y0, y1)
        width = abs(x1 - x0)
        height = abs(y1 - y0)

        min_size = 6
        if width < min_size or height < min_size:
            self.drag_start = None
            self.drag_current = None
            self.drag_mode = None
            self.drag_anchor = None
            self.drag_original = None
            self.drag_edge = None
            self.refresh_pixmap()
            return

        pm_w = self.current_pdfpix_qpixmap.width()
        pm_h = self.current_pdfpix_qpixmap.height()

        # normalize (0..1)
        px_norm = float(left) / float(pm_w)
        py_norm = float(top) / float(pm_h)
        pw_norm = float(width) / float(pm_w)
        ph_norm = float(height) / float(pm_h)

        self.positions[self.selected_field_id]["px"] = round(px_norm, 6)
        self.positions[self.selected_field_id]["py"] = round(py_norm, 6)
        self.positions[self.selected_field_id]["pw"] = round(pw_norm, 6)
        self.positions[self.selected_field_id]["ph"] = round(ph_norm, 6)

        self.statusBar().showMessage(
            f"{self.selected_field_id} -> ({px_norm:.3f}, {py_norm:.3f}, {pw_norm:.3f}, {ph_norm:.3f})"
        )

        self.drag_start = None
        self.drag_current = None
        self.drag_mode = None
        self.drag_anchor = None
        self.drag_original = None
        self.drag_edge = None
        self.refresh_pixmap()

    # ---------------------------
    # Save YAML layout
    #
    # We save x_percent / y_percent / w_percent / h_percent for each field.
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
                "w_percent": pos["pw"],
                "h_percent": pos["ph"],
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
        print("Usage: python layout_editor.py myfile.pdf [layout.yml]")
        sys.exit(1)

    app = QApplication(sys.argv)
    layout_path = sys.argv[2] if len(sys.argv) > 2 else None
    w = LayoutEditor(sys.argv[1], layout_path)
    w.showMaximized()
    sys.exit(app.exec())
