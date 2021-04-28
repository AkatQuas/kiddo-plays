package main

import (
	"strings"
	"testing"
)

func TestSimpleHello(t *testing.T) {
	got := Hello("42", "")

	want := "Hello, 42"

	if !strings.Contains(got, want) {
		t.Errorf("got %q want %q", got, want)
	}
}

func TestHello(t *testing.T) {
	assertCorrectMessage := func(t testing.TB, got, want string) {
		// this function is just a helper
		t.Helper()
		if got != want {
			t.Errorf("got %q want %q", got, want)
		}
	}

	t.Run("saying hello to peopel", func(t *testing.T) {
		got := Hello("Chris", "")
		want := "Hello, Chris"

		assertCorrectMessage(t, got, want)
	})

	t.Run("say 'Hello, 42' when an empty string is supplied", func(t *testing.T) {
		got := Hello("", "")
		want := "Hello, 42"

		assertCorrectMessage(t, got, want)
	})

	t.Run("in Spanish", func(t *testing.T) {
		got := Hello("Elodie", "Spanish")
		want := "Hola, Elodie"
		assertCorrectMessage(t, got, want)
	})

	t.Run("in French", func(t *testing.T) {
		got := Hello("Jizhe", "French")
		want := "Bonjour, Jizhe"
		assertCorrectMessage(t, got, want)
	})
}
