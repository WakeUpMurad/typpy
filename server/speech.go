package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Voice struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	Locale string `json:"locale"`
}

var voices = []Voice{
	{"en-US-JennyNeural", "Jenny · US", "en-US"},
	{"en-US-GuyNeural", "Guy · US", "en-US"},
	{"en-US-AriaNeural", "Aria · US", "en-US"},
	{"en-GB-SoniaNeural", "Sonia · UK", "en-GB"},
}
var speechRates = map[string]string{"0.65": "-35%", "0.85": "-15%", "1": "+0%", "1.2": "+20%"}

const maxAudioBytes = 2 << 20
const maxSpeechCache = 32 << 20

type SpeechService struct {
	endpoint   string
	client     *http.Client
	mu         sync.Mutex
	cache      map[string][]byte
	cacheBytes int
	slots      chan struct{}
}

func newSpeechService() *SpeechService {
	return &SpeechService{endpoint: "http://127.0.0.1:3001/synthesize", client: &http.Client{Timeout: 20 * time.Second}, cache: map[string][]byte{}, slots: make(chan struct{}, 2)}
}
func (s *SpeechService) configured() bool { return true }

var validVoice = regexp.MustCompile(`^en-(US|GB)-[A-Za-z0-9]+Neural$`)

type speechError struct {
	status  int
	message string
}

func (e *speechError) Error() string { return e.message }

// TextToSpeech accepts plain English text and returns MP3; context cancels in-flight HTTP.
func (s *SpeechService) TextToSpeech(ctx context.Context, text, voiceID string) ([]byte, error) {
	return s.textToSpeech(ctx, text, voiceID, "1")
}
func (s *SpeechService) textToSpeech(ctx context.Context, text, voiceID, speed string) ([]byte, error) {
	text = strings.TrimSpace(text)
	if text == "" || len(text) > 5000 {
		return nil, &speechError{400, "Нужен текст длиной от 1 до 5000 байт"}
	}
	if voiceID == "" {
		voiceID = "en-US-JennyNeural"
	}
	if !validVoice.MatchString(voiceID) {
		return nil, &speechError{400, "Нужен английский голос en-US-…Neural или en-GB-…Neural"}
	}
	if speed == "" {
		speed = "1"
	}
	rate, ok := speechRates[speed]
	if !ok {
		return nil, &speechError{400, "Некорректная скорость"}
	}

	return s.synthesize(ctx, text, Voice{ID: voiceID, Locale: "en-US"}, rate)
}
func writeSpeech(w http.ResponseWriter, audio []byte, err error) {
	if err != nil {
		status := 502
		if e, ok := err.(*speechError); ok {
			status = e.status
		}
		if status == 429 {
			w.Header().Set("Retry-After", "30")
		}
		sendJSON(w, status, map[string]string{"error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "audio/mpeg")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "private, max-age=86400")
	_, _ = w.Write(audio)
}
func (s *SpeechService) synthesize(ctx context.Context, text string, voice Voice, rate string) ([]byte, error) {
	cacheKey := voice.ID + "\n" + rate + "\n" + text
	s.mu.Lock()
	cached := s.cache[cacheKey]
	s.mu.Unlock()
	if cached != nil {
		return cached, nil
	}
	select {
	case s.slots <- struct{}{}:
		defer func() { <-s.slots }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	// A waiting request can reuse the clip synthesized by the previous request.
	s.mu.Lock()
	cached = s.cache[cacheKey]
	s.mu.Unlock()
	if cached != nil {
		return cached, nil
	}
	payload, _ := json.Marshal(map[string]string{"text": text, "voice": voice.ID, "rate": rate})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	response, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Сервис Edge TTS не ответил. Перезапусти приложение через pnpm dev")
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		switch response.StatusCode {
		case 401, 403:
			return nil, &speechError{502, "Edge TTS отклонил подключение. Попробуй позже"}
		case 429:
			return nil, &speechError{429, "Edge TTS занят. Попробуй через несколько секунд"}
		default:
			return nil, fmt.Errorf("Озвучка Edge TTS временно недоступна (HTTP %d)", response.StatusCode)
		}
	}
	audio, err := io.ReadAll(io.LimitReader(response.Body, maxAudioBytes+1))
	if err != nil || len(audio) == 0 || len(audio) > maxAudioBytes {
		return nil, fmt.Errorf("Не удалось получить аудио Edge TTS")
	}
	if !strings.HasPrefix(response.Header.Get("Content-Type"), "audio/") {
		return nil, fmt.Errorf("Edge TTS вернул неожиданный формат аудио")
	}
	s.mu.Lock()
	if s.cacheBytes+len(audio) > maxSpeechCache {
		s.cache = map[string][]byte{}
		s.cacheBytes = 0
	}
	if _, exists := s.cache[cacheKey]; !exists {
		s.cache[cacheKey] = audio
		s.cacheBytes += len(audio)
	}
	s.mu.Unlock()
	return audio, nil
}
func (s *SpeechService) register(mux *http.ServeMux, lessons []Lesson) {
	mux.HandleFunc("GET /api/speech/config", func(w http.ResponseWriter, r *http.Request) {
		sendJSON(w, 200, map[string]any{"configured": s.configured(), "voices": voices})
	})
	mux.HandleFunc("POST /api/speech", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Text  string `json:"text"`
			Voice string `json:"voice"`
			Rate  string `json:"rate"`
		}
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
		if err := decoder.Decode(&body); err != nil {
			sendJSON(w, 400, map[string]string{"error": "Некорректный JSON"})
			return
		}
		var extra any
		if decoder.Decode(&extra) != io.EOF {
			sendJSON(w, 400, map[string]string{"error": "Некорректный JSON"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 22*time.Second)
		defer cancel()
		audio, err := s.textToSpeech(ctx, body.Text, body.Voice, body.Rate)
		if r.Context().Err() != nil {
			return
		}
		writeSpeech(w, audio, err)
	})
	mux.HandleFunc("GET /api/speech", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(r.URL.Query().Get("id"))
		if err != nil {
			sendJSON(w, 400, map[string]string{"error": "Некорректный ID"})
			return
		}
		for _, lesson := range lessons {
			if lesson.ID == id {
				ctx, cancel := context.WithTimeout(r.Context(), 22*time.Second)
				defer cancel()
				audio, err := s.textToSpeech(ctx, lesson.English, r.URL.Query().Get("voice"), r.URL.Query().Get("rate"))
				if r.Context().Err() != nil {
					return
				}
				writeSpeech(w, audio, err)
				return
			}
		}
		sendJSON(w, 404, map[string]string{"error": "Предложение не найдено"})
	})
}
