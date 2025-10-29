package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"

	api "github.com/TheKrainBow/go-api"
	"github.com/jung-kurt/gofpdf"
)

// ---------- Configuration structures ----------

type FontConfig struct {
	Name string  `yaml:"name"`
	Path string  `yaml:"path"`
	Size float64 `yaml:"size"`
}

type APIConfig struct {
	TokenURL  string `yaml:"tokenUrl"`
	Endpoint  string `yaml:"endpoint"`
	TestPath  string `yaml:"testpath"`
	UID       string `yaml:"uid"`
	Secret    string `yaml:"secret"`
	Scope     string `yaml:"scope"`
}

type Config struct {
	EventID          int    `yaml:"event_id"`
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

	Comment          string `yaml:"comment"`
	TeacherFirstName string `yaml:"teacher_first_name"`
	TeacherLastName  string `yaml:"teacher_last_name"`
	DateString       string `yaml:"date_string"`

	Font   FontConfig `yaml:"font"`
	API42  APIConfig  `yaml:"42API"`
}

// ---------- Layout structure (percent coordinates) ----------

type LayoutEntry struct {
	XPercent float64 `yaml:"x_percent"`
	YPercent float64 `yaml:"y_percent"`
}

type PageLayout map[string]LayoutEntry

type EventUser struct {
    User struct {
        FirstName string `json:"first_name"`
        LastName  string `json:"last_name"`
    } `json:"user"`
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
func fetchAttendeesFrom42(client *api.APIClient, eventID int) ([]Attendee, error) {
    // Build URL to the event users endpoint
    url := fmt.Sprintf("/events/%d/events_users", eventID)

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

func fetchAttendees(cfg Config) ([]Attendee, error) {
	client, err := api.NewAPIClient(cfg.API42.Endpoint, api.APIClientInput{
		AuthType: api.AuthTypeClientCredentials,
		TokenURL: cfg.API42.TokenURL,
		Endpoint: cfg.API42.Endpoint,
		ClientID: cfg.API42.UID,
		TestPath: cfg.API42.TestPath,
		ClientSecret: cfg.API42.Secret,
		Scope: cfg.API42.Scope,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to init 42 API client: %v", err)
	}

	// --- Example call (to confirm connectivity) ---
	if cfg.API42.TestPath != "" {
		err := client.TestConnection()
		if err != nil {
			fmt.Printf("⚠️  Warning: 42 API test call failed: %v\n", err)
		} else {
			fmt.Println("✅  42 API test call succeeded.")
		}
	}
	return fetchAttendeesFrom42(client, cfg.EventID)

	// // --- TODO: Replace this with real endpoint ---
	// // /v2/events/:event_id/events_users
	// // For now, mock list:
	// return []Attendee{
	// 	{"Alice", "Martin"},
	// 	{"Bob", "Durand"},
	// 	{"Chloé", "Bernard"},
	// 	{"David", "Petit"},
	// 	{"Emma", "Robert"},
	// 	{"Farid", "Moreau"},
	// 	{"Gaël", "Fournier"},
	// 	{"Hugo", "Lambert"},
	// 	{"Inès", "Rousseau"},
	// 	{"Jules", "Blanc"},
	// }, nil
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

func drawText(pdf *gofpdf.Fpdf, x, y float64, text string) {
	pdf.Text(x, y, text)
}

func drawMultiline(pdf *gofpdf.Fpdf, x, y float64, text string) {
	lines := strings.Split(text, "\n")
	fontSz, _ := pdf.GetFontSize()
	lineHeight := pdf.PointConvert(fontSz) * 1.2
	for i, line := range lines {
		pdf.Text(x, y+float64(i)*lineHeight, line)
	}
}

func percentToMM(entry LayoutEntry, pageW, pageH float64) (xMM, yMM float64, ok bool) {
	if entry.XPercent < 0 || entry.YPercent < 0 {
		return 0, 0, false
	}
	return entry.XPercent * pageW, entry.YPercent * pageH, true
}

// ---------- PDF generation ----------

func generatePDFs(cfg Config, layout PageLayout, pages [][]Attendee) error {
	_ = os.MkdirAll(cfg.OutputFolder, 0o755)

	pageW, pageH := 210.0, 297.0
	orientation := "P"
	if cfg.Landscape {
		pageW, pageH = 297.0, 210.0
		orientation = "L"
	}

	totalPages := len(pages)
	lineStepMM := 8.0
	teacherFormatted := formatPersonName(cfg.TeacherFirstName, cfg.TeacherLastName)

	for i, group := range pages {
		pdf := gofpdf.New(orientation, "mm", "A4", "")
		pdf.AddUTF8Font(cfg.Font.Name, "", cfg.Font.Path)
		pdf.SetFont(cfg.Font.Name, "", cfg.Font.Size)
		pdf.AddPage()
		pdf.ImageOptions(cfg.PDFTemplateImage, 0, 0, pageW, pageH, false, gofpdf.ImageOptions{ReadDpi: true}, 0, "")

		if e, ok := layout["theme_origin"]; ok {
			if x, y, ok2 := percentToMM(e, pageW, pageH); ok2 {
				drawText(pdf, x, y, cfg.ThemeObjet)
			}
		}
		if e, ok := layout["intitule"]; ok {
			if x, y, ok2 := percentToMM(e, pageW, pageH); ok2 {
				drawText(pdf, x, y, cfg.Intitule)
			}
		}
		if e, ok := layout["fonds_concerne"]; ok {
			if x, y, ok2 := percentToMM(e, pageW, pageH); ok2 {
				drawText(pdf, x, y, cfg.FondsConcerne)
			}
		}
		if e, ok := layout["commentaire"]; ok {
			if x, y, ok2 := percentToMM(e, pageW, pageH); ok2 {
				drawMultiline(pdf, x, y, cfg.Comment)
			}
		}
		if e, ok := layout["duree_heures"]; ok {
			if x, y, ok2 := percentToMM(e, pageW, pageH); ok2 {
				drawText(pdf, x, y, fmt.Sprintf("%d", cfg.EventHourDuration))
			}
		}
		if e, ok := layout["duree_jours"]; ok {
			if x, y, ok2 := percentToMM(e, pageW, pageH); ok2 {
				drawText(pdf, x, y, fmt.Sprintf("%d", cfg.EventDaysDuration))
			}
		}

		// --- Morning time slots ---
		if e, ok := layout["matin_h1"]; ok && cfg.MorningStartAtHour >= 0 {
			if x, y, ok2 := percentToMM(e, pageW, pageH); ok2 {
				drawText(pdf, x, y, fmt.Sprintf("%02d", cfg.MorningStartAtHour))
			}
		}
		if e, ok := layout["matin_m1"]; ok && cfg.MorningStartAtMinute >= 0 {
			if x, y, ok2 := percentToMM(e, pageW, pageH); ok2 {
				drawText(pdf, x, y, fmt.Sprintf("%02d", cfg.MorningStartAtMinute))
			}
		}
		if e, ok := layout["matin_h2"]; ok && cfg.MorningEndAtHour >= 0 {
			if x, y, ok2 := percentToMM(e, pageW, pageH); ok2 {
				drawText(pdf, x, y, fmt.Sprintf("%02d", cfg.MorningEndAtHour))
			}
		}
		if e, ok := layout["matin_m2"]; ok && cfg.MorningEndAtMinute >= 0 {
			if x, y, ok2 := percentToMM(e, pageW, pageH); ok2 {
				drawText(pdf, x, y, fmt.Sprintf("%02d", cfg.MorningEndAtMinute))
			}
		}

		// --- Afternoon time slots ---
		if e, ok := layout["aprem_h1"]; ok && cfg.AfternoonStartAtHour >= 0 {
			if x, y, ok2 := percentToMM(e, pageW, pageH); ok2 {
				drawText(pdf, x, y, fmt.Sprintf("%02d", cfg.AfternoonStartAtHour))
			}
		}
		if e, ok := layout["aprem_m1"]; ok && cfg.AfternoonStartAtMinute >= 0 {
			if x, y, ok2 := percentToMM(e, pageW, pageH); ok2 {
				drawText(pdf, x, y, fmt.Sprintf("%02d", cfg.AfternoonStartAtMinute))
			}
		}
		if e, ok := layout["aprem_h2"]; ok && cfg.AfternoonEndAtHour >= 0 {
			if x, y, ok2 := percentToMM(e, pageW, pageH); ok2 {
				drawText(pdf, x, y, fmt.Sprintf("%02d", cfg.AfternoonEndAtHour))
			}
		}
		if e, ok := layout["aprem_m2"]; ok && cfg.AfternoonEndAtMinute >= 0 {
			if x, y, ok2 := percentToMM(e, pageW, pageH); ok2 {
				drawText(pdf, x, y, fmt.Sprintf("%02d", cfg.AfternoonEndAtMinute))
			}
		}

		// --- Attendees ---
		if base, ok := layout["premier_nom_etudiant"]; ok {
			if bx, by, ok2 := percentToMM(base, pageW, pageH); ok2 {
				for j, att := range group {
					drawText(pdf, bx, by+float64(j)*lineStepMM, formatPersonName(att.FirstName, att.LastName))
				}
			}
		}

		// --- Teacher ---
		if e, ok := layout["nom_surveillant"]; ok {
			if x, y, ok2 := percentToMM(e, pageW, pageH); ok2 {
				drawText(pdf, x, y, teacherFormatted)
			}
		}

		// --- Date + Pagination ---
		if e, ok := layout["date"]; ok {
			if x, y, ok2 := percentToMM(e, pageW, pageH); ok2 {
				drawText(pdf, x, y, cfg.DateString)
			}
		}
		if e, ok := layout["pagination"]; ok {
			if x, y, ok2 := percentToMM(e, pageW, pageH); ok2 {
				drawText(pdf, x, y, fmt.Sprintf("%d/%d", i+1, totalPages))
			}
		}

		outPath := filepath.Join(cfg.OutputFolder, fmt.Sprintf("sheet_%02d.pdf", i+1))
		if err := pdf.OutputFileAndClose(outPath); err != nil {
			return err
		}
	}

	return nil
}

// ---------- Loading ----------

func loadConfig(path string) (Config, error) {
	var cfg Config
	raw, err := os.ReadFile(path)
	if err != nil {
		return cfg, err
	}
	err = yaml.Unmarshal(raw, &cfg)
	return cfg, err
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

// ---------- Main ----------

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run main.go config.yml")
		return
	}

	cfg, err := loadConfig(os.Args[1])
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	layout, err := loadPageLayout(cfg.PageLayoutPath)
	if err != nil {
		log.Fatalf("failed to load page layout: %v", err)
	}

	attendees, err := fetchAttendees(cfg)
	if err != nil {
		log.Fatalf("failed to fetch attendees: %v", err)
	}
	if len(attendees) == 0 {
		log.Fatalf("no attendees found for event %d", cfg.EventID)
	}

	pages := splitIntoPages(attendees, 7)
	if err := generatePDFs(cfg, layout, pages); err != nil {
		log.Fatalf("failed to generate PDFs: %v", err)
	}

	fmt.Println("✅ PDFs generated successfully.")
}
