package main

import (
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

//go:embed mealplan.json
var mealPlanJSON []byte

//go:embed shopping.json
var shoppingJSON []byte

//go:embed all:web
var webFS embed.FS

type Meal struct {
	Name        string   `json:"name"`
	Ingredients []string `json:"ingredients,omitempty"`
	Method      []string `json:"method,omitempty"`
}

type DayMeals struct {
	Breakfast Meal   `json:"breakfast"`
	Lunch     Meal   `json:"lunch"`
	Dinner    Meal   `json:"dinner"`
	Snack     string `json:"snack"`
}

type Day struct {
	Day   int      `json:"day"`
	Meals DayMeals `json:"meals"`
}

type ShoppingCategory struct {
	Category string   `json:"category"`
	Items    []string `json:"items"`
}

type ShoppingResponse struct {
	Categories []ShoppingCategory `json:"categories"`
	Checked    []string           `json:"checked"`
}

type PlanResponse struct {
	Days      []Day  `json:"days"`
	StartDate string `json:"startDate"`
}

var db *sql.DB

func main() {
	dbPath := getenv("DB_PATH", "/data/purge-ldl.db")
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		log.Fatalf("mkdir db dir: %v", err)
	}

	var err error
	db, err = sql.Open("sqlite", dbPath+"?_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)")
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if err := initSchema(); err != nil {
		log.Fatalf("init schema: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/plan", handlePlan)
	mux.HandleFunc("GET /api/shopping", handleShoppingGet)
	mux.HandleFunc("POST /api/shopping/toggle", handleShoppingToggle)
	mux.HandleFunc("POST /api/shopping/reset", handleShoppingReset)
	mux.HandleFunc("GET /api/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	// Static React build
	sub, err := fs.Sub(webFS, "web")
	if err != nil {
		log.Fatalf("static fs: %v", err)
	}
	mux.Handle("/", spaHandler(sub))

	addr := ":" + getenv("PORT", "8080")
	log.Printf("purge-ldl listening on %s, db=%s", addr, dbPath)
	if err := http.ListenAndServe(addr, logRequests(mux)); err != nil {
		log.Fatal(err)
	}
}

func initSchema() error {
	const ddl = `
	CREATE TABLE IF NOT EXISTS settings (
		key   TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS shopping_checked (
		id         TEXT PRIMARY KEY,
		checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
	);
	`
	if _, err := db.Exec(ddl); err != nil {
		return err
	}

	// Seed start date = tomorrow on first run.
	var existing string
	err := db.QueryRow(`SELECT value FROM settings WHERE key='start_date'`).Scan(&existing)
	if errors.Is(err, sql.ErrNoRows) {
		tomorrow := time.Now().UTC().Add(24 * time.Hour).Format("2006-01-02")
		_, err = db.Exec(`INSERT INTO settings(key, value) VALUES('start_date', ?)`, tomorrow)
		return err
	}
	return err
}

func handlePlan(w http.ResponseWriter, r *http.Request) {
	var days []Day
	if err := json.Unmarshal(mealPlanJSON, &days); err != nil {
		httpErr(w, err)
		return
	}
	var startDate string
	if err := db.QueryRow(`SELECT value FROM settings WHERE key='start_date'`).Scan(&startDate); err != nil {
		httpErr(w, err)
		return
	}
	writeJSON(w, PlanResponse{Days: days, StartDate: startDate})
}

func handleShoppingGet(w http.ResponseWriter, r *http.Request) {
	var cats []ShoppingCategory
	if err := json.Unmarshal(shoppingJSON, &cats); err != nil {
		httpErr(w, err)
		return
	}
	rows, err := db.Query(`SELECT id FROM shopping_checked`)
	if err != nil {
		httpErr(w, err)
		return
	}
	defer rows.Close()
	checked := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			httpErr(w, err)
			return
		}
		checked = append(checked, id)
	}
	writeJSON(w, ShoppingResponse{Categories: cats, Checked: checked})
}

type toggleReq struct {
	ID      string `json:"id"`
	Checked bool   `json:"checked"`
}

func handleShoppingToggle(w http.ResponseWriter, r *http.Request) {
	var req toggleReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.ID) == "" {
		http.Error(w, "id required", http.StatusBadRequest)
		return
	}
	var err error
	if req.Checked {
		_, err = db.Exec(`INSERT OR IGNORE INTO shopping_checked(id) VALUES(?)`, req.ID)
	} else {
		_, err = db.Exec(`DELETE FROM shopping_checked WHERE id=?`, req.ID)
	}
	if err != nil {
		httpErr(w, err)
		return
	}
	writeJSON(w, map[string]any{"ok": true})
}

func handleShoppingReset(w http.ResponseWriter, r *http.Request) {
	if _, err := db.Exec(`DELETE FROM shopping_checked`); err != nil {
		httpErr(w, err)
		return
	}
	writeJSON(w, map[string]any{"ok": true})
}

// spaHandler serves embedded static files and falls back to index.html for SPA routing.
func spaHandler(root fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clean := strings.TrimPrefix(r.URL.Path, "/")
		if clean == "" {
			clean = "index.html"
		}
		if _, err := fs.Stat(root, clean); err != nil {
			// SPA fallback
			r2 := r.Clone(r.Context())
			r2.URL.Path = "/"
			b, err := fs.ReadFile(root, "index.html")
			if err != nil {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write(b)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func httpErr(w http.ResponseWriter, err error) {
	log.Printf("error: %v", err)
	http.Error(w, "internal error", http.StatusInternalServerError)
}

func logRequests(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		h.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
