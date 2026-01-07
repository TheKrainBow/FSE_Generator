package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gopkg.in/yaml.v3"

	api "github.com/TheKrainBow/go-api"
	"github.com/jung-kurt/gofpdf"
	"github.com/jung-kurt/gofpdf/contrib/gofpdi"
)

// ---------- Configuration structures ----------

type FontConfig struct {
	Name string  `yaml:"name"`
	Path string  `yaml:"path"`
	Size float64 `yaml:"size"`
}

type APIConfig struct {
	TokenURL string `yaml:"tokenUrl"`
	Endpoint string `yaml:"endpoint"`
	TestPath string `yaml:"testpath"`
	UID      string `yaml:"uid"`
	Secret   string `yaml:"secret"`
	Scope    string `yaml:"scope"`
}

type Config struct {
	EventID          int    `yaml:"event_id"`
	ExamID           int    `yaml:"exam_id"`
	CSVPath          string `yaml:"csv_path"`
	CSVPathLegacy    string `yaml:"CSVPath"`
	PDFTemplateImage string `yaml:"pdf_template_image"`
	OutputFolder     string `yaml:"output_folder"`
	PageLayoutPath   string `yaml:"pageLayout"`

	Landscape bool `yaml:"landscape"`

	ThemeObjet    string `yaml:"theme_objet"`
	Intitule      string `yaml:"intitule"`
	FondsConcerne string `yaml:"fonds_concerne"`

	EventHourDuration int `yaml:"event_hour_duration"`
	EventDaysDuration int `yaml:"event_days_duration"`

	MorningStartAtHour   int `yaml:"morning_start_at_hour"`
	MorningStartAtMinute int `yaml:"morning_start_at_minute"`
	MorningEndAtHour     int `yaml:"morning_end_at_hour"`
	MorningEndAtMinute   int `yaml:"morning_end_at_minute"`

	AfternoonStartAtHour   int `yaml:"afternoon_start_at_hour"`
	AfternoonStartAtMinute int `yaml:"afternoon_start_at_minute"`
	AfternoonEndAtHour     int `yaml:"afternoon_end_at_hour"`
	AfternoonEndAtMinute   int `yaml:"afternoon_end_at_minute"`

	Comment          string  `yaml:"comment"`
	TeacherFirstName string  `yaml:"teacher_first_name"`
	TeacherLastName  string  `yaml:"teacher_last_name"`
	DateString       string  `yaml:"date_string"`
	StudentNameMaxMM float64 `yaml:"student_name_max_width_mm"`
	StudentNameMinPT float64 `yaml:"student_name_min_font_pt"`

	Font  FontConfig `yaml:"font"`
	API42 APIConfig  `yaml:"42API"`
}

// ---------- Layout structure (percent coordinates) ----------

type LayoutEntry struct {
	XPercent float64 `yaml:"x_percent"`
	YPercent float64 `yaml:"y_percent"`
	WPercent float64 `yaml:"w_percent"`
	HPercent float64 `yaml:"h_percent"`
}

type PageLayout map[string]LayoutEntry

type EventUser struct {
	User struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
	} `json:"user"`
}

type APIItem struct {
	Name     string `json:"name"`
	BeginAt  string `json:"begin_at"`
	EndAt    string `json:"end_at"`
	Location string `json:"location"`
}

// ---------- Event attendees ----------

type Attendee struct {
	FirstName string
	LastName  string
}

func formatPersonName(first, last string) string {
	lastUpper := strings.ToUpper(strings.TrimSpace(last))
	firstLower := strings.ToLower(strings.TrimSpace(first))
	runes := []rune(firstLower)
	if len(runes) > 0 {
		runes[0] = []rune(strings.ToUpper(string(runes[0])))[0]
	}
	firstNorm := string(runes)
	return lastUpper + " " + firstNorm
}

// ---------- API Fetch ----------
func fetchAttendeesFrom42(client *api.APIClient, path string) ([]Attendee, error) {
	// Build URL to the event/exam users endpoint
	url := path

	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("42 API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	var raw []EventUser
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	var attendees []Attendee
	for _, e := range raw {
		attendees = append(attendees, Attendee{
			FirstName: e.User.FirstName,
			LastName:  e.User.LastName,
		})
	}

	return attendees, nil
}

func buildAPIClient(cfg Config) (*api.APIClient, error) {
	client, err := api.NewAPIClient(cfg.API42.Endpoint, api.APIClientInput{
		AuthType:     api.AuthTypeClientCredentials,
		TokenURL:     cfg.API42.TokenURL,
		Endpoint:     cfg.API42.Endpoint,
		ClientID:     cfg.API42.UID,
		TestPath:     cfg.API42.TestPath,
		ClientSecret: cfg.API42.Secret,
		Scope:        cfg.API42.Scope,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to init 42 API client: %v", err)
	}
	return client, nil
}

func testAPIConnection(cfg Config, client *api.APIClient) {
	if cfg.API42.TestPath != "" {
		err := client.TestConnection()
		if err != nil {
			fmt.Printf("⚠️  Warning: 42 API test call failed: %v\n", err)
		} else {
			fmt.Println("✅  42 API test call succeeded.")
		}
	}
}

type sourceKind int

const (
	sourceCustom sourceKind = iota
	sourceEvent
	sourceExam
)

func determineSource(cfg Config) (sourceKind, int, error) {
	if cfg.CSVPath != "" {
		return sourceCustom, 0, nil
	}
	if cfg.ExamID > 0 {
		return sourceExam, cfg.ExamID, nil
	}
	if cfg.EventID > 0 {
		return sourceEvent, cfg.EventID, nil
	}
	return sourceCustom, 0, fmt.Errorf("missing attendee source: set csv_path, exam_id, or event_id")
}

func fetchItemInfo(client *api.APIClient, kind sourceKind, id int) (APIItem, error) {
	var item APIItem
	var path string
	switch kind {
	case sourceEvent:
		path = fmt.Sprintf("/events/%d", id)
	case sourceExam:
		path = fmt.Sprintf("/exams/%d", id)
	default:
		return item, fmt.Errorf("unsupported source for info fetch")
	}

	resp, err := client.Get(path)
	if err != nil {
		return item, fmt.Errorf("42 API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return item, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	if err := json.NewDecoder(resp.Body).Decode(&item); err != nil {
		return item, fmt.Errorf("failed to parse JSON: %w", err)
	}
	return item, nil
}

func fetchAttendeesWithClient(client *api.APIClient, kind sourceKind, id int) ([]Attendee, error) {
	var path string
	switch kind {
	case sourceEvent:
		path = fmt.Sprintf("/events/%d/events_users", id)
	case sourceExam:
		path = fmt.Sprintf("/exams/%d/exams_users", id)
	default:
		return nil, fmt.Errorf("unsupported source for attendees")
	}
	return fetchAttendeesFrom42(client, path)
}

func normalizeHeader(value string) string {
	value = strings.TrimSpace(value)
	value = strings.TrimPrefix(value, "\ufeff")
	value = strings.ToLower(value)
	value = strings.ReplaceAll(value, " ", "")
	value = strings.ReplaceAll(value, "_", "")
	return value
}

func detectCSVDelimiter(data string) rune {
	for _, line := range strings.Split(data, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.Count(line, ";") > strings.Count(line, ",") {
			return ';'
		}
		return ','
	}
	return ','
}

func fetchAttendeesFromCSV(path string) ([]Attendee, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	data := string(raw)
	reader := csv.NewReader(strings.NewReader(data))
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1
	reader.Comma = detectCSVDelimiter(data)

	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}
	if len(records) == 0 {
		return nil, fmt.Errorf("csv has no rows: %s", path)
	}

	firstNameIdx, lastNameIdx := 0, 1
	startRow := 0
	headerDetected := false
	header := records[0]
	for i, col := range header {
		switch normalizeHeader(col) {
		case "firstname":
			firstNameIdx = i
			headerDetected = true
		case "lastname":
			lastNameIdx = i
			headerDetected = true
		}
	}
	if headerDetected {
		startRow = 1
	}

	var attendees []Attendee
	for _, row := range records[startRow:] {
		if len(row) <= firstNameIdx || len(row) <= lastNameIdx {
			continue
		}
		first := strings.TrimSpace(row[firstNameIdx])
		last := strings.TrimSpace(row[lastNameIdx])
		if first == "" && last == "" {
			continue
		}
		attendees = append(attendees, Attendee{
			FirstName: first,
			LastName:  last,
		})
	}

	if len(attendees) == 0 {
		return nil, fmt.Errorf("csv has no attendees: %s", path)
	}
	return attendees, nil
}

// ---------- Utility ----------

func splitIntoPages(attendees []Attendee, perPage int) [][]Attendee {
	var pages [][]Attendee
	for i := 0; i < len(attendees); i += perPage {
		end := i + perPage
		if end > len(attendees) {
			end = len(attendees)
		}
		pages = append(pages, attendees[i:end])
	}
	return pages
}

func boxFromLayout(entry LayoutEntry, pageW, pageH float64) (xMM, yMM, wMM, hMM float64, ok bool) {
	if entry.XPercent < 0 || entry.YPercent < 0 || entry.WPercent <= 0 || entry.HPercent <= 0 {
		return 0, 0, 0, 0, false
	}
	return entry.XPercent * pageW, entry.YPercent * pageH, entry.WPercent * pageW, entry.HPercent * pageH, true
}

func drawTextFitBox(pdf *gofpdf.Fpdf, x, y, w, h float64, text string, align string, vCenter bool, wrap bool, minFontPt float64) {
	if text == "" || w <= 0 || h <= 0 {
		return
	}
	if minFontPt <= 0 {
		minFontPt = 6
	}
	origSize, _ := pdf.GetFontSize()
	if minFontPt > origSize {
		minFontPt = origSize
	}

	var lines []string
	lineHeight := 0.0
	ascent := 0.0
	fit := false

	for size := origSize; size >= minFontPt; size -= 0.5 {
		pdf.SetFontSize(size)
		if wrap {
			lines = pdf.SplitText(text, w)
		} else {
			lines = []string{text}
			if pdf.GetStringWidth(text) > w {
				continue
			}
		}
		fontHeight := pdf.PointConvert(size)
		lineHeight = fontHeight * 1.2
		ascent = fontHeight * 0.8
		if lineHeight*float64(len(lines)) <= h {
			fit = true
			break
		}
	}

	if !fit {
		pdf.SetFontSize(minFontPt)
		if wrap {
			lines = pdf.SplitText(text, w)
		} else {
			lines = []string{text}
		}
		fontHeight := pdf.PointConvert(minFontPt)
		lineHeight = fontHeight * 1.2
		ascent = fontHeight * 0.8
	}

	totalHeight := lineHeight * float64(len(lines))
	startY := y + ascent
	if vCenter {
		startY = y + (h-totalHeight)/2 + ascent
	}

	for i, line := range lines {
		lineW := pdf.GetStringWidth(line)
		lineX := x
		switch align {
		case "center":
			lineX = x + (w-lineW)/2
		case "right":
			lineX = x + w - lineW
		}
		pdf.Text(lineX, startY+float64(i)*lineHeight, line)
	}

	pdf.SetFontSize(origSize)
}

func addBackground(pdf *gofpdf.Fpdf, templatePath string, pageW, pageH float64) error {
	ext := strings.ToLower(filepath.Ext(templatePath))
	switch ext {
	case ".pdf":
		tpl := gofpdi.ImportPage(pdf, templatePath, 1, "/MediaBox")
		gofpdi.UseImportedTemplate(pdf, tpl, 0, 0, pageW, pageH)
	default:
		pdf.ImageOptions(templatePath, 0, 0, pageW, pageH, false, gofpdf.ImageOptions{ReadDpi: true}, 0, "")
	}
	if err := pdf.Error(); err != nil {
		return err
	}
	return nil
}

func parseAPITime(value string) (time.Time, error) {
	if value == "" {
		return time.Time{}, fmt.Errorf("empty time value")
	}
	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return t, nil
	}
	if t, err := time.Parse(time.RFC3339Nano, value); err == nil {
		return t, nil
	}
	return time.Time{}, fmt.Errorf("unsupported time format: %s", value)
}

func splitByNoon(begin, end time.Time) (mh1, mm1, mh2, mm2, ah1, am1, ah2, am2 int) {
	mh1, mm1, mh2, mm2 = -1, -1, -1, -1
	ah1, am1, ah2, am2 = -1, -1, -1, -1
	if end.Before(begin) {
		return
	}
	noon := time.Date(begin.Year(), begin.Month(), begin.Day(), 12, 0, 0, 0, begin.Location())
	if end.Before(noon) || end.Equal(noon) {
		mh1, mm1 = begin.Hour(), begin.Minute()
		mh2, mm2 = end.Hour(), end.Minute()
		return
	}
	if begin.After(noon) || begin.Equal(noon) {
		ah1, am1 = begin.Hour(), begin.Minute()
		ah2, am2 = end.Hour(), end.Minute()
		return
	}
	mh1, mm1 = begin.Hour(), begin.Minute()
	mh2, mm2 = 12, 0
	ah1, am1 = 12, 0
	ah2, am2 = end.Hour(), end.Minute()
	return
}

// ---------- PDF generation ----------

func generatePDFs(cfg Config, layout PageLayout, pages [][]Attendee) ([]string, error) {
	_ = os.MkdirAll(cfg.OutputFolder, 0o755)

	pageW, pageH := 210.0, 297.0
	orientation := "P"
	if cfg.Landscape {
		pageW, pageH = 297.0, 210.0
		orientation = "L"
	}

	totalPages := len(pages)
	teacherFormatted := formatPersonName(cfg.TeacherFirstName, cfg.TeacherLastName)

	var outPaths []string
	for i, group := range pages {
		pdf := gofpdf.New(orientation, "mm", "A4", "")
		pdf.AddUTF8Font(cfg.Font.Name, "", cfg.Font.Path)
		pdf.SetFont(cfg.Font.Name, "", cfg.Font.Size)
		pdf.AddPage()
		if err := addBackground(pdf, cfg.PDFTemplateImage, pageW, pageH); err != nil {
			return nil, err
		}

		if e, ok := layout["theme_origin"]; ok {
			if x, y, w, h, ok2 := boxFromLayout(e, pageW, pageH); ok2 {
				drawTextFitBox(pdf, x, y, w, h, cfg.ThemeObjet, "left", true, false, 6)
			}
		}
		if e, ok := layout["intitule"]; ok {
			if x, y, w, h, ok2 := boxFromLayout(e, pageW, pageH); ok2 {
				drawTextFitBox(pdf, x, y, w, h, cfg.Intitule, "left", true, false, 6)
			}
		}
		if e, ok := layout["fonds_concerne"]; ok {
			if x, y, w, h, ok2 := boxFromLayout(e, pageW, pageH); ok2 {
				drawTextFitBox(pdf, x, y, w, h, cfg.FondsConcerne, "left", true, false, 6)
			}
		}
		if e, ok := layout["commentaire"]; ok {
			if x, y, w, h, ok2 := boxFromLayout(e, pageW, pageH); ok2 {
				drawTextFitBox(pdf, x, y, w, h, cfg.Comment, "center", true, true, 6)
			}
		}
		if e, ok := layout["duree_heures"]; ok && cfg.EventHourDuration >= 0 {
			if x, y, w, h, ok2 := boxFromLayout(e, pageW, pageH); ok2 {
				drawTextFitBox(pdf, x, y, w, h, fmt.Sprintf("%d", cfg.EventHourDuration), "center", true, false, 6)
			}
		}
		if e, ok := layout["duree_jours"]; ok && cfg.EventDaysDuration >= 0 {
			if x, y, w, h, ok2 := boxFromLayout(e, pageW, pageH); ok2 {
				drawTextFitBox(pdf, x, y, w, h, fmt.Sprintf("%d", cfg.EventDaysDuration), "center", true, false, 6)
			}
		}

		// --- Morning time slots ---
		if e, ok := layout["matin_h1"]; ok && cfg.MorningStartAtHour >= 0 {
			if x, y, w, h, ok2 := boxFromLayout(e, pageW, pageH); ok2 {
				drawTextFitBox(pdf, x, y, w, h, fmt.Sprintf("%02d", cfg.MorningStartAtHour), "center", true, false, 6)
			}
		}
		if e, ok := layout["matin_m1"]; ok && cfg.MorningStartAtMinute >= 0 {
			if x, y, w, h, ok2 := boxFromLayout(e, pageW, pageH); ok2 {
				drawTextFitBox(pdf, x, y, w, h, fmt.Sprintf("%02d", cfg.MorningStartAtMinute), "center", true, false, 6)
			}
		}
		if e, ok := layout["matin_h2"]; ok && cfg.MorningEndAtHour >= 0 {
			if x, y, w, h, ok2 := boxFromLayout(e, pageW, pageH); ok2 {
				drawTextFitBox(pdf, x, y, w, h, fmt.Sprintf("%02d", cfg.MorningEndAtHour), "center", true, false, 6)
			}
		}
		if e, ok := layout["matin_m2"]; ok && cfg.MorningEndAtMinute >= 0 {
			if x, y, w, h, ok2 := boxFromLayout(e, pageW, pageH); ok2 {
				drawTextFitBox(pdf, x, y, w, h, fmt.Sprintf("%02d", cfg.MorningEndAtMinute), "center", true, false, 6)
			}
		}

		// --- Afternoon time slots ---
		if e, ok := layout["aprem_h1"]; ok && cfg.AfternoonStartAtHour >= 0 {
			if x, y, w, h, ok2 := boxFromLayout(e, pageW, pageH); ok2 {
				drawTextFitBox(pdf, x, y, w, h, fmt.Sprintf("%02d", cfg.AfternoonStartAtHour), "center", true, false, 6)
			}
		}
		if e, ok := layout["aprem_m1"]; ok && cfg.AfternoonStartAtMinute >= 0 {
			if x, y, w, h, ok2 := boxFromLayout(e, pageW, pageH); ok2 {
				drawTextFitBox(pdf, x, y, w, h, fmt.Sprintf("%02d", cfg.AfternoonStartAtMinute), "center", true, false, 6)
			}
		}
		if e, ok := layout["aprem_h2"]; ok && cfg.AfternoonEndAtHour >= 0 {
			if x, y, w, h, ok2 := boxFromLayout(e, pageW, pageH); ok2 {
				drawTextFitBox(pdf, x, y, w, h, fmt.Sprintf("%02d", cfg.AfternoonEndAtHour), "center", true, false, 6)
			}
		}
		if e, ok := layout["aprem_m2"]; ok && cfg.AfternoonEndAtMinute >= 0 {
			if x, y, w, h, ok2 := boxFromLayout(e, pageW, pageH); ok2 {
				drawTextFitBox(pdf, x, y, w, h, fmt.Sprintf("%02d", cfg.AfternoonEndAtMinute), "center", true, false, 6)
			}
		}

		// --- Attendees ---
		if base, ok := layout["premier_nom_etudiant"]; ok {
			if bx, by, bw, bh, ok2 := boxFromLayout(base, pageW, pageH); ok2 {
				rowH := bh / 7.0
				for j, att := range group {
					rowY := by + float64(j)*rowH
					drawTextFitBox(
						pdf,
						bx+3,
						rowY,
						bw-3,
						rowH,
						formatPersonName(att.FirstName, att.LastName),
						"left",
						true,
						false,
						6,
					)
				}
			}
		}

		// --- Teacher ---
		if e, ok := layout["nom_surveillant"]; ok {
			if x, y, w, h, ok2 := boxFromLayout(e, pageW, pageH); ok2 {
				drawTextFitBox(pdf, x, y, w, h, teacherFormatted, "center", true, false, 6)
			}
		}

		// --- Date + Pagination ---
		if e, ok := layout["date"]; ok {
			if x, y, w, h, ok2 := boxFromLayout(e, pageW, pageH); ok2 {
				drawTextFitBox(pdf, x, y, w, h, cfg.DateString, "right", true, false, 6)
			}
		}
		if e, ok := layout["pagination"]; ok {
			if x, y, w, h, ok2 := boxFromLayout(e, pageW, pageH); ok2 {
				drawTextFitBox(pdf, x, y, w, h, fmt.Sprintf("%d/%d", i+1, totalPages), "left", true, false, 6)
			}
		}

		outPath := filepath.Join(cfg.OutputFolder, fmt.Sprintf("sheet_%02d.pdf", i+1))
		if err := pdf.OutputFileAndClose(outPath); err != nil {
			return nil, err
		}
		outPaths = append(outPaths, outPath)
	}

	return outPaths, nil
}

// ---------- Loading ----------

func normalizeKey(key string) string {
	return strings.ToLower(strings.TrimSpace(key))
}

func loadConfig(path string) (Config, map[string]bool, error) {
	var cfg Config
	raw, err := os.ReadFile(path)
	if err != nil {
		return cfg, nil, err
	}
	overrideKeys := make(map[string]bool)
	var rawMap map[string]interface{}
	if err := yaml.Unmarshal(raw, &rawMap); err == nil {
		for key := range rawMap {
			overrideKeys[normalizeKey(key)] = true
		}
	}
	err = yaml.Unmarshal(raw, &cfg)
	if cfg.CSVPath == "" && cfg.CSVPathLegacy != "" {
		cfg.CSVPath = cfg.CSVPathLegacy
	}
	return cfg, overrideKeys, err
}

func loadPageLayout(path string) (PageLayout, error) {
	var layout PageLayout
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	err = yaml.Unmarshal(raw, &layout)
	return layout, err
}

func overrideSet(overrides map[string]bool, key string) bool {
	if overrides == nil {
		return false
	}
	return overrides[normalizeKey(key)]
}

func applyAPIOverrides(cfg *Config, overrides map[string]bool, kind sourceKind, item APIItem) error {
	begin, err := parseAPITime(item.BeginAt)
	if err != nil {
		return err
	}
	end, err := parseAPITime(item.EndAt)
	if err != nil {
		return err
	}
	loc, locErr := time.LoadLocation("Europe/Paris")
	if locErr != nil {
		loc = time.Local
	}
	begin = begin.In(loc)
	end = end.In(loc)

	computedDate := begin.Format("02/01/2006")
	if !overrideSet(overrides, "date_string") {
		cfg.DateString = computedDate
	}
	dateForTheme := cfg.DateString
	if !overrideSet(overrides, "date_string") {
		dateForTheme = computedDate
	}

	if !overrideSet(overrides, "fonds_concerne") {
		cfg.FondsConcerne = "FSE+"
	}
	if !overrideSet(overrides, "comment") {
		switch kind {
		case sourceExam:
			cfg.Comment = "Exam Stud " + item.Location
		case sourceEvent:
			cfg.Comment = item.Location
		}
	}

	if !overrideSet(overrides, "intitule") && kind == sourceEvent {
		cfg.Intitule = item.Name
	}

	var prefix string
	switch kind {
	case sourceEvent:
		prefix = "Event"
	case sourceExam:
		prefix = "Exam Stud"
	}
	if !overrideSet(overrides, "theme_objet") {
		cfg.ThemeObjet = fmt.Sprintf("%s %s", prefix, dateForTheme)
	}

	durationHours := end.Sub(begin).Hours()
	if durationHours < 0 {
		durationHours = 0
	}
	if !overrideSet(overrides, "event_hour_duration") {
		cfg.EventHourDuration = int(math.Round(durationHours))
	}
	if !overrideSet(overrides, "event_days_duration") {
		cfg.EventDaysDuration = int(math.Ceil(durationHours / 24.0))
		if cfg.EventDaysDuration == 0 && durationHours > 0 {
			cfg.EventDaysDuration = 1
		}
	}

	var mh1, mm1, mh2, mm2, ah1, am1, ah2, am2 int
	if kind == sourceExam {
		mh1, mm1, mh2, mm2, ah1, am1, ah2, am2 = -1, -1, -1, -1, -1, -1, -1, -1
		if begin.Hour() < 12 {
			mh1, mm1 = begin.Hour(), begin.Minute()
			mh2, mm2 = end.Hour(), end.Minute()
		} else {
			ah1, am1 = begin.Hour(), begin.Minute()
			ah2, am2 = end.Hour(), end.Minute()
		}
	} else {
		mh1, mm1, mh2, mm2, ah1, am1, ah2, am2 = splitByNoon(begin, end)
	}
	if !overrideSet(overrides, "morning_start_at_hour") {
		cfg.MorningStartAtHour = mh1
	}
	if !overrideSet(overrides, "morning_start_at_minute") {
		cfg.MorningStartAtMinute = mm1
	}
	if !overrideSet(overrides, "morning_end_at_hour") {
		cfg.MorningEndAtHour = mh2
	}
	if !overrideSet(overrides, "morning_end_at_minute") {
		cfg.MorningEndAtMinute = mm2
	}
	if !overrideSet(overrides, "afternoon_start_at_hour") {
		cfg.AfternoonStartAtHour = ah1
	}
	if !overrideSet(overrides, "afternoon_start_at_minute") {
		cfg.AfternoonStartAtMinute = am1
	}
	if !overrideSet(overrides, "afternoon_end_at_hour") {
		cfg.AfternoonEndAtHour = ah2
	}
	if !overrideSet(overrides, "afternoon_end_at_minute") {
		cfg.AfternoonEndAtMinute = am2
	}

	return nil
}

func applyCustomDefaults(cfg *Config, overrides map[string]bool) {
	if !overrideSet(overrides, "event_hour_duration") {
		cfg.EventHourDuration = -1
	}
	if !overrideSet(overrides, "event_days_duration") {
		cfg.EventDaysDuration = -1
	}
	if !overrideSet(overrides, "morning_start_at_hour") {
		cfg.MorningStartAtHour = -1
	}
	if !overrideSet(overrides, "morning_start_at_minute") {
		cfg.MorningStartAtMinute = -1
	}
	if !overrideSet(overrides, "morning_end_at_hour") {
		cfg.MorningEndAtHour = -1
	}
	if !overrideSet(overrides, "morning_end_at_minute") {
		cfg.MorningEndAtMinute = -1
	}
	if !overrideSet(overrides, "afternoon_start_at_hour") {
		cfg.AfternoonStartAtHour = -1
	}
	if !overrideSet(overrides, "afternoon_start_at_minute") {
		cfg.AfternoonStartAtMinute = -1
	}
	if !overrideSet(overrides, "afternoon_end_at_hour") {
		cfg.AfternoonEndAtHour = -1
	}
	if !overrideSet(overrides, "afternoon_end_at_minute") {
		cfg.AfternoonEndAtMinute = -1
	}
}

func sanitizeFilenamePart(value string) string {
	value = strings.TrimSpace(value)
	value = strings.ReplaceAll(value, "/", "-")
	value = strings.ReplaceAll(value, "\\", "-")
	value = strings.ReplaceAll(value, " ", "_")
	value = strings.ReplaceAll(value, ":", "-")
	return value
}

func combinedOutputName(cfg Config, kind sourceKind) string {
	datePart := sanitizeFilenamePart(cfg.DateString)
	switch kind {
	case sourceExam:
		if datePart == "" {
			datePart = "unknown-date"
		}
		return fmt.Sprintf("exam_%d_%s.pdf", cfg.ExamID, datePart)
	case sourceEvent:
		if datePart == "" {
			datePart = "unknown-date"
		}
		return fmt.Sprintf("event_%d_%s.pdf", cfg.EventID, datePart)
	default:
		if datePart == "" {
			return "custom.pdf"
		}
		return fmt.Sprintf("custom_%s.pdf", datePart)
	}
}

func writeCombinedPDF(paths []string, outPath, orientation string, pageW, pageH float64) error {
	if len(paths) == 0 {
		return nil
	}
	pdf := gofpdf.New(orientation, "mm", "A4", "")
	for _, path := range paths {
		tpl := gofpdi.ImportPage(pdf, path, 1, "/MediaBox")
		pdf.AddPage()
		gofpdi.UseImportedTemplate(pdf, tpl, 0, 0, pageW, pageH)
	}
	return pdf.OutputFileAndClose(outPath)
}

// ---------- Main ----------

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run main.go config.yml")
		return
	}

	cfg, overrides, err := loadConfig(os.Args[1])
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	kind, id, err := determineSource(cfg)
	if err != nil {
		log.Fatalf("failed to determine source: %v", err)
	}

	var client *api.APIClient
	switch kind {
	case sourceEvent, sourceExam:
		client, err = buildAPIClient(cfg)
		if err != nil {
			log.Fatalf("failed to init 42 API client: %v", err)
		}
		testAPIConnection(cfg, client)
		item, err := fetchItemInfo(client, kind, id)
		if err != nil {
			log.Fatalf("failed to fetch event/exam: %v", err)
		}
		if err := applyAPIOverrides(&cfg, overrides, kind, item); err != nil {
			log.Fatalf("failed to apply event/exam defaults: %v", err)
		}
	case sourceCustom:
		applyCustomDefaults(&cfg, overrides)
	}

	layout, err := loadPageLayout(cfg.PageLayoutPath)
	if err != nil {
		log.Fatalf("failed to load page layout: %v", err)
	}

	var attendees []Attendee
	if kind == sourceCustom {
		attendees, err = fetchAttendeesFromCSV(cfg.CSVPath)
	} else {
		attendees, err = fetchAttendeesWithClient(client, kind, id)
	}
	if err != nil {
		log.Fatalf("failed to fetch attendees: %v", err)
	}
	if len(attendees) == 0 {
		if cfg.CSVPath != "" {
			log.Fatalf("no attendees found in CSV: %s", cfg.CSVPath)
		}
		if kind == sourceExam {
			log.Fatalf("no attendees found for exam %d", cfg.ExamID)
		}
		log.Fatalf("no attendees found for event %d", cfg.EventID)
	}

	pages := splitIntoPages(attendees, 7)
	outPaths, err := generatePDFs(cfg, layout, pages)
	if err != nil {
		log.Fatalf("failed to generate PDFs: %v", err)
	}

	orientation := "P"
	pageW, pageH := 210.0, 297.0
	if cfg.Landscape {
		orientation = "L"
		pageW, pageH = 297.0, 210.0
	}
	combinedName := combinedOutputName(cfg, kind)
	combinedPath := filepath.Join(cfg.OutputFolder, combinedName)
	if err := writeCombinedPDF(outPaths, combinedPath, orientation, pageW, pageH); err != nil {
		log.Fatalf("failed to generate combined PDF: %v", err)
	}

	fmt.Println("✅ PDFs generated successfully.")
}
