package main

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

func TestSpeechRESTAndCache(t *testing.T) {
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.Method != "POST" || r.Header.Get("Content-Type") != "application/json" {
			t.Error("wrong REST headers")
		}
		body, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(body), "en-US-JennyNeural") || !strings.Contains(string(body), "Hello") {
			t.Errorf("incorrect JSON: %s", body)
		}
		w.Header().Set("Content-Type", "audio/mpeg")
		_, _ = w.Write([]byte("ID3-test"))
	}))
	defer upstream.Close()
	s := newSpeechService()
	s.endpoint = upstream.URL
	for i := 0; i < 2; i++ {
		audio, err := s.TextToSpeech(context.Background(), "Hello & <world>", "")
		if err != nil || string(audio) != "ID3-test" {
			t.Fatalf("audio=%q err=%v", audio, err)
		}
	}
	if calls.Load() != 1 {
		t.Fatalf("cache missed: %d", calls.Load())
	}
}

func TestSpeechAPIValidation(t *testing.T) {
	s := newSpeechService()
	s.endpoint = ""
	mux := http.NewServeMux()
	s.register(mux, nil)
	cases := []struct {
		body   string
		status int
	}{
		{`{"text":""}`, 400},
		{`{"text":"Hello","voice":"bad\"voice"}`, 400},
		{`{"text":"Hello","rate":"4"}`, 400},

		{`{"text":"Hello"} {}`, 400},
	}
	for _, c := range cases {
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("POST", "/api/speech", strings.NewReader(c.body)))
		if w.Code != c.status {
			t.Errorf("body %s: status %d, want %d", c.body, w.Code, c.status)
		}
	}
}

func TestSpeechUpstreamErrors(t *testing.T) {
	for _, status := range []int{401, 403, 429, 500} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(status)
				_, _ = w.Write([]byte("secret upstream diagnostic"))
			}))
			defer upstream.Close()
			s := newSpeechService()
			s.endpoint = upstream.URL
			mux := http.NewServeMux()
			s.register(mux, nil)
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, httptest.NewRequest("POST", "/api/speech", strings.NewReader(`{"text":"Hello","voice":"en-US-AriaNeural"}`)))
			want := 502
			if status == 429 {
				want = 429
			}
			if w.Code != want || strings.Contains(w.Body.String(), "secret") {
				t.Fatalf("status %d: %d %s", status, w.Code, w.Body.String())
			}
		})
	}
}
func TestSpeechCancellation(t *testing.T) {
	s := newSpeechService()
	s.endpoint = "https://example.invalid"
	s.slots <- struct{}{}
	s.slots <- struct{}{}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := s.TextToSpeech(ctx, "Hello", ""); err != context.Canceled {
		t.Fatalf("expected cancellation, got %v", err)
	}
}
