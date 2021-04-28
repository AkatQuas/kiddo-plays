package concurrency

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"
)

func mockWebsiteChecker(url string) bool {
	if url == "what://example.com" {
		return false
	}
	return true
}

func slowStubWebsiteChecker(url string) bool {
	time.Sleep(20 * time.Millisecond)
	return true
}

func TestCheckWebsites(t *testing.T) {
	websites := []string{
		"http://google.com",
		"http://blog.gypsydave5.com",
		"what://example.com",
	}

	want := map[string]bool{
		"http://google.com":          true,
		"http://blog.gypsydave5.com": true,
		"what://example.com":         false,
	}
	got := CheckWebsites(mockWebsiteChecker, websites)
	if !reflect.DeepEqual(want, got) {
		t.Fatalf("Wanted %v, got %v", want, got)
	}
}

// go test -bench="."
func BenchmarkCheckWebsites(b *testing.B) {
	urls := make([]string, 100)
	for i := 0; i < len(urls); i++ {
		urls[i] = "a url"
	}
	for i := 0; i < b.N; i++ {
		CheckWebsites(slowStubWebsiteChecker, urls)
	}
}

func TestRacer(t *testing.T) {
	// tenSecondTimeout := 10 * time.Second
	t.Run("correct url", func(t *testing.T) {
		slowServer := makeDelayedServer(20 * time.Millisecond)
		fastServer := makeDelayedServer(1 * time.Millisecond)

		defer slowServer.Close()
		defer fastServer.Close()

		slowURL := slowServer.URL
		fastURL := fastServer.URL

		want := fastURL
		got, _ := Racer(slowURL, fastURL)

		if got != want {
			t.Errorf("got %q, want %q", got, want)
		}
	})
	t.Run("returns an error if a server doesn't respond within 10s", func(t *testing.T) {
		serverA := makeDelayedServer(11 * time.Second)
		serverB := makeDelayedServer(12 * time.Second)
		defer serverA.Close()
		defer serverB.Close()

		_, err := Racer(serverA.URL, serverB.URL)

		if err == nil {
			t.Errorf("expected an error but didn't get one")
		}
	})

	t.Run("returns an error if a server doesn't respond within the specified time", func(t *testing.T) {
		server := makeDelayedServer(25 * time.Millisecond)
		defer server.Close()

		_, err := ConfigurableReacer(server.URL, server.URL, 20*time.Millisecond)

		if err == nil {
			t.Errorf("expected an error but didn't get one")
		}
	})
}

func makeDelayedServer(delay time.Duration) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(delay)
		w.WriteHeader(http.StatusOK)
	}))
}
