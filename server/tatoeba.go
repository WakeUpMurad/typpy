package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"
)

type corpusSentence struct {
	ID           int              `json:"id"`
	Text         string           `json:"text"`
	Lang         string           `json:"lang"`
	License      string           `json:"license"`
	Owner        string           `json:"owner"`
	Unapproved   bool             `json:"is_unapproved"`
	Translations []corpusSentence `json:"translations"`
}

func allowedLicense(license string) bool { return license == "CC BY 2.0 FR" || license == "CC0 1.0" }
func convertSentences(sentences []corpusSentence) []Lesson {
	result := make([]Lesson, 0, len(sentences))
	for _, en := range sentences {
		if en.Lang != "eng" || en.Unapproved || !allowedLicense(en.License) || en.Text == "" {
			continue
		}
		for _, ru := range en.Translations {
			if ru.Lang != "rus" || ru.Unapproved || !allowedLicense(ru.License) || ru.Text == "" {
				continue
			}
			result = append(result, Lesson{ID: 100000000 + en.ID, Category: "real", English: en.Text, Russian: ru.Text, EnglishSource: &Attribution{ID: en.ID, Owner: en.Owner, License: en.License}, RussianSource: &Attribution{ID: ru.ID, Owner: ru.Owner, License: ru.License}})
			break
		}
	}
	return result
}

// Import is explicit: practice itself works offline and never waits for Tatoeba.
func importTatoeba(query string) error {
	params := url.Values{"lang": {"eng"}, "q": {query}, "sort": {"relevance"}, "limit": {"30"}, "word_count": {"5-14"}, "is_unapproved": {"no"}, "trans:lang": {"rus"}, "trans:is_direct": {"yes"}, "trans:is_unapproved": {"no"}, "showtrans": {"matching"}}
	client := &http.Client{Timeout: 20 * time.Second}
	response, err := client.Get("https://api.tatoeba.org/v1/sentences?" + params.Encode())
	if err != nil {
		return fmt.Errorf("Tatoeba недоступна: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("Tatoeba вернула HTTP %d", response.StatusCode)
	}
	var payload struct {
		Data []corpusSentence `json:"data"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 2<<20)).Decode(&payload); err != nil {
		return err
	}
	imported := convertSentences(payload.Data)
	if len(imported) == 0 {
		return fmt.Errorf("не найдено подходящих пар EN/RU для %q", query)
	}
	const path = "server/tatoeba.json"
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var existing []Lesson
	if err := json.Unmarshal(data, &existing); err != nil {
		return err
	}
	seen := map[int]bool{}
	for _, lesson := range existing {
		seen[lesson.ID] = true
	}
	count := 0
	for _, lesson := range imported {
		if !seen[lesson.ID] {
			existing = append(existing, lesson)
			seen[lesson.ID] = true
			count++
		}
	}
	data, err = json.MarshalIndent(existing, "", "  ")
	if err != nil {
		return err
	}
	// Write atomically so a failed import cannot damage the previous corpus.
	temporary, err := os.CreateTemp("server", "tatoeba-*.json")
	if err != nil {
		return err
	}
	defer os.Remove(temporary.Name())
	if _, err = temporary.Write(append(data, '\n')); err != nil {
		temporary.Close()
		return err
	}
	if err = temporary.Close(); err != nil {
		return err
	}
	if err = os.Rename(temporary.Name(), path); err != nil {
		return err
	}
	fmt.Printf("Добавлено %d предложений. Всего в Tatoeba-наборе: %d. Перезапустите Go-сервер.\n", count, len(existing))
	return nil
}
