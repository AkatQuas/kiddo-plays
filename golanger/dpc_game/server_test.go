package dpc_game

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestGETPlayers(t *testing.T) {
	store := StubPlayerStore{
		map[string]int{
			"boboka": 2,
			"ame":    11,
		},
		nil,
		nil,
	}
	server := mustMakePlayerServer(t, &store, dummyGame)

	t.Run("returns boboka's score", func(t *testing.T) {
		request := newGetScoreRequest("boboka")
		response := httptest.NewRecorder()

		server.ServeHTTP(response, request)

		assertStatus(t, response.Code, http.StatusOK)
		assertResponseBody(t, response.Body.String(), "2")
	})

	t.Run("returns ame's score", func(t *testing.T) {
		request := newGetScoreRequest("ame")
		response := httptest.NewRecorder()

		server.ServeHTTP(response, request)

		assertStatus(t, response.Code, http.StatusOK)
		assertResponseBody(t, response.Body.String(), "11")
	})
	t.Run("returns 404 on missing players", func(t *testing.T) {
		request := newGetScoreRequest("old_eleven")
		response := httptest.NewRecorder()

		server.ServeHTTP(response, request)

		assertStatus(t, response.Code, http.StatusNotFound)
	})
}

func TestStoreWins(t *testing.T) {
	store := &StubPlayerStore{
		map[string]int{},
		[]string{},
		nil,
	}
	server := mustMakePlayerServer(t, store, dummyGame)
	t.Run("it returns accepted on POST", func(t *testing.T) {
		player := "boboka"
		request := newPostWinRequest(player)
		response := httptest.NewRecorder()

		server.ServeHTTP(response, request)

		assertStatus(t, response.Code, http.StatusAccepted)
		AssertPlayerWin(t, store, player)
	})
}

func TestLeague(t *testing.T) {
	wantedLeague := League{
		{"Hello", 42},
		{"World", 24},
		{"Forty_two", 14},
	}
	store := StubPlayerStore{nil, nil, wantedLeague}
	server := mustMakePlayerServer(t, &store, dummyGame)

	t.Run("returns the league table as JSON with status 200 on '/league'", func(t *testing.T) {
		request := newLeagueRequest()
		response := httptest.NewRecorder()

		server.ServeHTTP(response, request)
		assertStatus(t, response.Code, http.StatusOK)
		assertContentType(t, response, jsonContentType)
		got := getLeagueFromResponse(t, response.Body)
		assertLeague(t, got, wantedLeague)
	})
}

func TestGame(t *testing.T) {
	t.Run("GET /game returns 200", func(t *testing.T) {
		server := mustMakePlayerServer(t, &StubPlayerStore{}, dummyGame)
		request := newGameRequest()
		response := httptest.NewRecorder()

		server.ServeHTTP(response, request)
		assertStatus(t, response.Code, http.StatusOK)
	})
	t.Run("start a game with 3 players and declare boboka the winner", func(t *testing.T) {
		game := &GameSpy{}

		winner := "boboka"

		server := httptest.NewServer(mustMakePlayerServer(t, dummyPlayerStore, game))

		ws := mustDialWS(t, "ws"+strings.TrimPrefix(server.URL, "http")+"/ws")

		defer func() {
			server.Close()
			ws.Close()
		}()

		writeWSMessage(t, ws, "3")
		writeWSMessage(t, ws, winner)

		time.Sleep(10 * time.Millisecond)
		assertGameStartedWith(t, game, 3)
		assertGameFinishCalledWith(t, game, winner)
	})
}

func mustMakePlayerServer(t *testing.T, store PlayerStore, game Game) *PlayerServer {
	server, err := NewPlayerServer(store, game)
	if err != nil {
		t.Fatal("problem creating player server", err)
	}
	return server
}

func mustDialWS(t *testing.T, url string) *websocket.Conn {
	ws, _, err := websocket.DefaultDialer.Dial(url, nil)

	if err != nil {
		t.Fatalf("could not open a ws connection on %s %v", url, err)
	}

	return ws
}

func writeWSMessage(t testing.TB, conn *websocket.Conn, message string) {
	t.Helper()
	if err := conn.WriteMessage(websocket.TextMessage, []byte(message)); err != nil {
		t.Fatalf("could not send message over ws connection %v", err)
	}
}

func newGetScoreRequest(name string) *http.Request {
	req, _ := http.NewRequest(http.MethodGet, fmt.Sprintf("/players/%s", name), nil)
	return req
}

func newPostWinRequest(name string) *http.Request {
	req, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("/players/%s", name), nil)
	return req
}

func newLeagueRequest() *http.Request {
	req, _ := http.NewRequest(http.MethodGet, "/league", nil)
	return req
}

func newGameRequest() *http.Request {
	req, _ := http.NewRequest(http.MethodGet, "/game", nil)
	return req
}

func getLeagueFromResponse(t testing.TB, body io.Reader) (league League) {
	t.Helper()
	err := json.NewDecoder(body).Decode(&league)

	if err != nil {
		t.Fatalf("Unable to parse response from server %q into slice of Player, '%v'", body, err)
	}

	return
}

func assertLeague(t testing.TB, got, want League) {
	t.Helper()
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %v want %v", got, want)
	}
}

func assertStatus(t testing.TB, got, want int) {
	t.Helper()
	if got != want {
		t.Errorf("did not get correct status, got %d, want %d", got, want)
	}
}

func assertResponseBody(t testing.TB, got, want string) {
	t.Helper()
	if got != want {
		t.Errorf("response body is wrong, got %q want %q", got, want)
	}
}

func assertContentType(t testing.TB, response *httptest.ResponseRecorder, want string) {
	t.Helper()
	if response.Result().Header.Get("content-type") != want {
		t.Errorf("response did not have content-type of %s, got %v", want, response.Result().Header)
	}
}
