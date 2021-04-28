package dependency_injection

import (
	"bytes"
	"reflect"
	"testing"
	"time"
)

func TestGreet(t *testing.T) {
	buffer := bytes.Buffer{}
	GreetToBuffer(&buffer, "42")

	got := buffer.String()
	want := "Hello, 42"
	assertStringEqual(t, got, want)
}

type SpySleepr struct {
	Calls int
}

func (s *SpySleepr) Sleep() {
	s.Calls++
}

const (
	sleep = "sleep"
	write = "write"
)

type CountdownOperationsSpy struct {
	Calls []string
}

func (s *CountdownOperationsSpy) Sleep() {
	s.Calls = append(s.Calls, sleep)
}

func (s *CountdownOperationsSpy) Write(p []byte) (n int, err error) {
	s.Calls = append(s.Calls, write)
	return
}
func TestCountdown(t *testing.T) {
	t.Run("run with time and print", func(t *testing.T) {
		buffer := &bytes.Buffer{}
		spySleeper := &SpySleepr{}

		Countdown(buffer, spySleeper)

		got := buffer.String()
		want := `3
2
1
Go!`

		assertStringEqual(t, got, want)

		if spySleeper.Calls != 3 {
			t.Errorf("not enough calls to sleeper, want 3 got %d", spySleeper.Calls)
		}
	})

	t.Run("run with write/sleep actions", func(t *testing.T) {
		spySleepPrinter := &CountdownOperationsSpy{}
		Countdown(spySleepPrinter, spySleepPrinter)
		want := []string{
			write,
			sleep,
			write,
			sleep,
			write,
			sleep,
			write,
		}
		if !reflect.DeepEqual(want, spySleepPrinter.Calls) {
			t.Errorf("want calls %v got %v", want, spySleepPrinter.Calls)
		}
	})
}

type SpyTime struct {
	durationSlept time.Duration
}

func (s *SpyTime) Sleep(duration time.Duration) {
	s.durationSlept = duration
}

func TestConfigurableSleeper(t *testing.T) {
	sleepTime := 5 * time.Second

	spyTime := &SpyTime{}
	sleeper := ConfigurableSleeper{sleepTime, spyTime.Sleep}
	sleeper.Sleep()

	if spyTime.durationSlept != sleepTime {
		t.Errorf("should have slept for %v but slept for %v", sleepTime, spyTime.durationSlept)
	}
}

func assertStringEqual(t testing.TB, got, want string) {
	t.Helper()
	if got != want {
		t.Errorf("got %q want %q", got, want)
	}
}
