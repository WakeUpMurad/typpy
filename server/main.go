package main

import (
	"embed"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

//go:embed lessons.json tatoeba.json
var content embed.FS

type Attribution struct {
	ID      int    `json:"id"`
	Owner   string `json:"owner"`
	License string `json:"license"`
}
type Lesson struct {
	ID            int          `json:"id"`
	Category      string       `json:"category"`
	English       string       `json:"en"`
	Russian       string       `json:"ru"`
	EnglishSource *Attribution `json:"englishSource,omitempty"`
	RussianSource *Attribution `json:"russianSource,omitempty"`
}

func normalize(text string) string {
	text = strings.NewReplacer("’", "'", "‘", "'", "“", "\"", "”", "\"").Replace(text)
	return strings.TrimSuffix(strings.ToLower(strings.Join(strings.Fields(text), " ")), ".")
}
func loadLessons() ([]Lesson, error) {
	var all []Lesson
	for _, name := range []string{"lessons.json", "tatoeba.json"} {
		data, err := content.ReadFile(name)
		if err != nil {
			return nil, err
		}
		var list []Lesson
		if err := json.Unmarshal(data, &list); err != nil {
			return nil, err
		}
		for i := range list {
			list[i].English = strings.TrimSuffix(strings.TrimSpace(list[i].English), ".")
			list[i].Russian = strings.TrimSuffix(strings.TrimSpace(list[i].Russian), ".")
		}
		all = append(all, list...)
	}
	return all, nil
}
func sendJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
func routes(lessons []Lesson, dist string) http.Handler {
	mux := http.NewServeMux()
	newSpeechService().register(mux, lessons)
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) { sendJSON(w, 200, map[string]bool{"ok": true}) })
	mux.HandleFunc("GET /api/lessons", func(w http.ResponseWriter, r *http.Request) { sendJSON(w, 200, lessons) })
	mux.HandleFunc("POST /api/check", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			ID     int     `json:"id"`
			Answer *string `json:"answer"`
		}
		r.Body = http.MaxBytesReader(w, r.Body, 8192)
		decoder := json.NewDecoder(r.Body)
		if err := decoder.Decode(&body); err != nil || body.Answer == nil {
			sendJSON(w, 400, map[string]string{"error": "Некорректный ответ."})
			return
		}
		if err := decoder.Decode(new(any)); err != io.EOF {
			sendJSON(w, 400, map[string]string{"error": "Некорректный JSON."})
			return
		}
		for _, lesson := range lessons {
			if lesson.ID == body.ID {
				sendJSON(w, 200, map[string]any{"correct": normalize(*body.Answer) == normalize(lesson.English), "expected": lesson.English})
				return
			}
		}
		sendJSON(w, 404, map[string]string{"error": "Предложение не найдено."})
	})
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		sendJSON(w, 404, map[string]string{"error": "Маршрут не найден."})
	})
	files := http.FileServer(http.Dir(dist))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if _, err := os.Stat(filepath.Join(dist, "index.html")); errors.Is(err, os.ErrNotExist) {
			http.Error(w, "Сначала выполните pnpm build или откройте Vite на порту 5173.", 503)
			return
		}
		files.ServeHTTP(w, r)
	})
	return mux
}
func main() {

	importQuery := flag.String("import-tatoeba", "", "Импортировать предложения Tatoeba по английскому слову")
	flag.Parse()
	if *importQuery != "" {
		if err := importTatoeba(*importQuery); err != nil {
			log.Fatal(err)
		}
		return
	}
	lessons, err := loadLessons()
	if err != nil {
		log.Fatal(err)
	}
	host := os.Getenv("HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	server := &http.Server{Addr: host + ":" + port, Handler: routes(lessons, "dist"), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 25 * time.Second, IdleTimeout: 60 * time.Second}
	fmt.Printf("Typpy: http://%s:%s\n", host, port)
	log.Fatal(server.ListenAndServe())
}
