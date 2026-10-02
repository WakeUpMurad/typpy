package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCheck(t *testing.T) {
	lessons := []Lesson{{ID: 1, English: "I don't know."}}
	handler := routes(lessons, t.TempDir())
	tests := []struct {
		body    string
		status  int
		correct bool
	}{
		{`{"id":1,"answer":"  I DON’T   know. "}`, 200, true},
		{`{"id":1,"answer":"I dont know."}`, 200, false},
		{`{"id":1,"answer":"I don't know"}`, 200, true},
		{`{"id":1,"answer":""}`, 200, false},
		{`{"id":999,"answer":"hello"}`, 404, false},
		{`{"id":1}`, 400, false},
		{`{"id":1,"answer":42}`, 400, false},
		{`{"id":1,"answer":"hello"} {}`, 400, false},
		{`invalid`, 400, false},
	}
	for _, tt := range tests {
		t.Run(tt.body, func(t *testing.T) {
			res := httptest.NewRecorder()
			handler.ServeHTTP(res, httptest.NewRequest("POST", "/api/check", strings.NewReader(tt.body)))
			if res.Code != tt.status {
				t.Fatalf("status %d, want %d", res.Code, tt.status)
			}
			if tt.status == 200 {
				var result struct {
					Correct bool `json:"correct"`
				}
				if err := json.Unmarshal(res.Body.Bytes(), &result); err != nil {
					t.Fatal(err)
				}
				if result.Correct != tt.correct {
					t.Fatalf("correct %v, want %v", result.Correct, tt.correct)
				}
			}
		})
	}
}
func TestLessonsAndHealth(t *testing.T) {
	lessons, err := loadLessons()
	if err != nil {
		t.Fatal(err)
	}
	if len(lessons) < 30 {
		t.Fatal("missing starter lessons")
	}
	seen := map[int]bool{}
	for _, l := range lessons {
		if seen[l.ID] || l.English == "" || l.Russian == "" {
			t.Fatalf("invalid lesson: %+v", l)
		}
		seen[l.ID] = true
	}
	handler := routes(lessons, t.TempDir())
	for _, path := range []string{"/api/lessons", "/api/health"} {
		r := httptest.NewRecorder()
		handler.ServeHTTP(r, httptest.NewRequest(http.MethodGet, path, nil))
		if r.Code != 200 || !json.Valid(r.Body.Bytes()) {
			t.Fatalf("invalid response for %s", path)
		}
	}
}
func TestConvertSentences(t *testing.T) {
	valid := corpusSentence{ID: 42, Text: "Life is good.", Lang: "eng", License: "CC0 1.0", Owner: "author", Translations: []corpusSentence{{ID: 43, Text: "Жизнь хороша.", Lang: "rus", License: "CC BY 2.0 FR", Owner: "translator"}}}
	invalid := valid
	invalid.License = "PROBLEM"
	noTranslation := valid
	noTranslation.Translations = nil
	unapproved := valid
	unapproved.Unapproved = true
	result := convertSentences([]corpusSentence{valid, invalid, noTranslation, unapproved})
	if len(result) != 1 || result[0].EnglishSource.ID != 42 || result[0].RussianSource.Owner != "translator" {
		t.Fatalf("invalid imported pairs: %+v", result)
	}
}
