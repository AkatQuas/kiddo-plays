package dpc_game

import (
	"bytes"
	"fmt"
	"io"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// Dummy objects are passed around but never actually used.
// Usually they are just used to fill parameter lists.
var (
	dummyBlindAlerter = &SpyBlindAlerter{}
	dummyPlayerStore  = &StubPlayerStore{}
	dummyStdIn        = &bytes.Buffer{}
	dummyStdOut       = &bytes.Buffer{}
	dummyGame         = &GameSpy{}
	tenMS             = 10 * time.Millisecond
)

func TestCLI(t *testing.T) {
	t.Run("record boboka win from user input", func(t *testing.T) {
		input := strings.NewReader("1\nboboka wins\n")
		playerStore := &StubPlayerStore{}
		game := NewDPCGame(dummyBlindAlerter, playerStore)

		cli := NewCLI(input, dummyStdOut, game)

		cli.Play()
		AssertPlayerWin(t, playerStore, "boboka")
	})
	t.Run("record ame win from user input", func(t *testing.T) {
		input := strings.NewReader("1\name wins\n")
		playerStore := &StubPlayerStore{}
		game := NewDPCGame(dummyBlindAlerter, playerStore)

		cli := NewCLI(input, dummyStdOut, game)

		cli.Play()
		AssertPlayerWin(t, playerStore, "ame")
	})
	t.Run("schedules printing of blind values", func(t *testing.T) {
		in := strings.NewReader("5\nboboka wins\n")
		playerStore := &StubPlayerStore{}
		blindAlerter := &SpyBlindAlerter{}
		game := NewDPCGame(blindAlerter, playerStore)

		cli := NewCLI(in, dummyStdOut, game)
		cli.Play()

		cases := []ScheduledAlert{
			{0 * time.Second, 100},
			{10 * time.Minute, 200},
			{20 * time.Minute, 300},
			{30 * time.Minute, 400},
			{40 * time.Minute, 500},
			{50 * time.Minute, 600},
			{60 * time.Minute, 800},
			{70 * time.Minute, 1000},
			{80 * time.Minute, 2000},
			{90 * time.Minute, 4000},
			{100 * time.Minute, 8000},
		}
		for i, want := range cases {
			t.Run(fmt.Sprint(want), func(t *testing.T) {

				if len(blindAlerter.alerts) <= i {
					t.Fatalf("alert %d was not scheduled %v", i, blindAlerter.alerts)
				}

				got := blindAlerter.alerts[i]
				assertScheduledAlert(t, got, want)
			})
		}
	})
	t.Run("it prompts the user to enter the number of players", func(t *testing.T) {
		stdout := &bytes.Buffer{}
		in := strings.NewReader("7\n")
		blindAlerter := &SpyBlindAlerter{}
		game := NewDPCGame(blindAlerter, dummyPlayerStore)

		cli := NewCLI(in, stdout, game)
		cli.Play()

		assertMessagesSentToUser(t, stdout, PlayerPrompt)

		cases := []ScheduledAlert{
			{0 * time.Second, 100},
			{12 * time.Minute, 200},
			{24 * time.Minute, 300},
			{36 * time.Minute, 400},
		}

		for i, want := range cases {
			t.Run(fmt.Sprint(want), func(t *testing.T) {
				if len(blindAlerter.alerts) <= i {
					t.Fatalf("alert %d was not scheduled %v", i, blindAlerter.alerts)
				}
				got := blindAlerter.alerts[i]
				assertScheduledAlert(t, got, want)
			})
		}
	})
	t.Run("it prompts the user to enter the number of players and starts the game", func(t *testing.T) {
		stdout := &bytes.Buffer{}
		in := strings.NewReader("7\n")
		game := &GameSpy{}

		cli := NewCLI(in, stdout, game)
		cli.Play()

		assertMessagesSentToUser(t, stdout, PlayerPrompt)
		assertGameStartedWith(t, game, 7)
	})

	t.Run("it prints an error when a non numeric value is entered and does not start the game", func(t *testing.T) {
		stdout := &bytes.Buffer{}
		in := strings.NewReader("Flights\n")
		game := &GameSpy{}

		cli := NewCLI(in, stdout, game)
		cli.Play()

		assertGameNotStarted(t, game)
		assertMessagesSentToUser(t, stdout, PlayerPrompt, BadPlayerInputErrMsg)
	})

	t.Run("start game with 3 players and finish game with 'ame' as winner", func(t *testing.T) {
		game := &GameSpy{}

		out := &bytes.Buffer{}
		in := userSends("3", "ame wins")

		NewCLI(in, out, game).Play()

		assertMessagesSentToUser(t, out, PlayerPrompt)
		assertGameStartedWith(t, game, 3)
		assertGameFinishCalledWith(t, game, "ame")
	})
	t.Run("start a game with 3 players, send blind alerts down WS and declare ame the winner", func(t *testing.T) {
		wantedBlindAlert := "Blind is 100"
		winner := "ame"

		game := &GameSpy{BlindAlerter: []byte(wantedBlindAlert)}

		server := httptest.NewServer(mustMakePlayerServer(t, dummyPlayerStore, game))
		ws := mustDialWS(t, "ws"+strings.TrimPrefix(server.URL, "http")+"/ws")

		defer func() {
			server.Close()
			ws.Close()
		}()

		writeWSMessage(t, ws, "3")
		writeWSMessage(t, ws, winner)

		time.Sleep(tenMS)
		assertGameStartedWith(t, game, 3)
		assertGameFinishCalledWith(t, game, winner)

		within(t, tenMS, func() {
			assertWebsocketGotMsg(t, ws, wantedBlindAlert)
		})
	})
}

type SpyBlindAlerter struct {
	alerts []ScheduledAlert
}

func (s *SpyBlindAlerter) ScheduleAlertAt(duration time.Duration, amount int, to io.Writer) {
	s.alerts = append(s.alerts, ScheduledAlert{duration, amount})
}

type GameSpy struct {
	StartedWith  int
	FinishedWith string
	BlindAlerter []byte

	StartCalled    bool
	FinishedCalled bool
}

func (g *GameSpy) Start(numberOfPlayers int, to io.Writer) {
	g.StartCalled = true
	g.StartedWith = numberOfPlayers
	to.Write(g.BlindAlerter)
}

func (g *GameSpy) Finish(winner string) {
	g.FinishedCalled = true
	g.FinishedWith = winner
}

func assertScheduledAlert(t testing.TB, got, want ScheduledAlert) {
	t.Helper()
	amountGot := got.Amount
	if amountGot != want.Amount {
		t.Errorf("got amount %d, want %d", amountGot, want.Amount)
	}

	gotScheduledTime := got.At
	if gotScheduledTime != want.At {
		t.Errorf("got scheduled time of %v, want %v", gotScheduledTime, want.At)
	}
}

func assertWebsocketGotMsg(t *testing.T, ws *websocket.Conn, want string) {
	_, msg, _ := ws.ReadMessage()
	if string(msg) != want {
		t.Errorf(`got "%s", want "%s"`, string(msg), want)
	}
}

func userSends(messages ...string) io.Reader {
	return strings.NewReader(strings.Join(messages, "\n"))
}

func within(t testing.TB, d time.Duration, assert func()) {
	t.Helper()

	done := make(chan struct{}, 1)
	go func() {
		assert()
		done <- struct{}{}
	}()

	select {
	case <-time.After(d):
		t.Errorf("timed out")
	case <-done:
	}
}

func checkSchedulingCases(cases []ScheduledAlert, t *testing.T, blindAlerter *SpyBlindAlerter) {
	for i, want := range cases {
		t.Run(fmt.Sprint(want), func(t *testing.T) {
			if len(blindAlerter.alerts) <= i {
				t.Fatalf("alert %d was not scheduled %v", i, blindAlerter.alerts)
			}
			got := blindAlerter.alerts[i]
			if !reflect.DeepEqual(got, cases[i]) {
				t.Errorf("alert not match, got %v, want %v", got, cases[i])
			}
		})
	}
}

func assertMessagesSentToUser(t testing.TB, stdout *bytes.Buffer, messages ...string) {
	t.Helper()
	want := strings.Join(messages, "")
	got := stdout.String()
	if got != want {
		t.Errorf("got %q sent to stdout but expected %+v", got, messages)
	}
}

func assertGameNotFinished(t testing.TB, game *GameSpy) {
	t.Helper()
	if game.FinishedCalled {
		t.Errorf("game should not have finished")
	}
}

func assertGameNotStarted(t testing.TB, game *GameSpy) {
	t.Helper()
	if game.StartCalled {
		t.Errorf("game should not have started")
	}
}

func assertGameStartedWith(t testing.TB, game *GameSpy, want int) {
	t.Helper()

	if game.StartedWith != want {
		t.Errorf("wanted Start called with %d but got %d", want, game.StartedWith)
	}
}

func assertGameFinishCalledWith(t testing.TB, game *GameSpy, want string) {
	t.Helper()
	passed := retryUntil(500*time.Millisecond, func() bool {
		return game.FinishedWith == want
	})

	if !passed {
		t.Errorf("wanted Start called with %q but got %q", want, game.FinishedWith)
	}
}

func retryUntil(d time.Duration, f func() bool) bool {
	deadline := time.Now().Add(d)
	for time.Now().Before(deadline) {
		// keep running f
		// until the deadline
		if f() {
			return true
		}
	}
	return false
}
