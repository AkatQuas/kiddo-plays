package dpc_game

import (
	"io/ioutil"
	"os"
	"testing"
)

func TestFileSystemStore(t *testing.T) {
	t.Run("league from a reader", func(t *testing.T) {
		database, cleanDatabase := createTempFile(t, `[
			{"Name": "hello", "Wins": 42},
			{"Name": "world", "Wins": 32}]`)
		defer cleanDatabase()

		store, _ := NewFileSystemPlayerStore(database)

		got := store.GetLeague()

		want := League{
			{"hello", 42},
			{"world", 32},
		}

		assertLeague(t, got, want)
	})
	t.Run("get player score", func(t *testing.T) {
		database, cleanDatabase := createTempFile(t, `[
			{"Name": "hello", "Wins": 42},
			{"Name": "world", "Wins": 32}]`)
		defer cleanDatabase()
		store, _ := NewFileSystemPlayerStore(database)

		got := store.GetPlayerScore("hello")
		assertScoreEquals(t, got, 42)
	})
	t.Run("store wins for existing players", func(t *testing.T) {
		database, cleanDatabase := createTempFile(t, `[
			{"Name": "hello", "Wins": 42},
			{"Name": "world", "Wins": 32}]`)
		defer cleanDatabase()

		store, _ := NewFileSystemPlayerStore(database)

		store.RecordWin("world")

		got := store.GetPlayerScore("world")
		want := 33
		assertScoreEquals(t, got, want)
	})
	t.Run("store wins for new players", func(t *testing.T) {
		database, cleanDatabase := createTempFile(t, `[
			{"Name": "hello", "Wins": 42},
			{"Name": "world", "Wins": 32}]`)
		defer cleanDatabase()

		store, _ := NewFileSystemPlayerStore(database)

		store.RecordWin("forty_two")

		got := store.GetPlayerScore("forty_two")
		want := 1
		assertScoreEquals(t, got, want)
	})
	t.Run("works with an empty file", func(t *testing.T) {
		database, clean := createTempFile(t, "")
		defer clean()

		_, err := NewFileSystemPlayerStore(database)
		assertNoError(t, err)
	})
	t.Run("league sorted", func(t *testing.T) {
		database, clean := createTempFile(t, `[
			{"Name": "hello", "Wins": 33},
			{"Name": "world", "Wins": 42}]`)
		defer clean()

		store, err := NewFileSystemPlayerStore(database)

		assertNoError(t, err)

		got := store.GetLeague()

		want := League{
			{"world", 42},
			{"hello", 33},
		}

		assertLeague(t, got, want)

		got = store.GetLeague()
		assertLeague(t, got, want)
	})
}

func assertScoreEquals(t testing.TB, got, want int) {
	t.Helper()
	if got != want {
		t.Errorf("got %d, want %d", got, want)
	}
}

func createTempFile(t testing.TB, initialData string) (*os.File, func()) {
	t.Helper()

	tmpfile, err := ioutil.TempFile("", "db")

	if err != nil {
		t.Fatalf("could not create temp file %v", err)
	}
	tmpfile.Write([]byte(initialData))
	removeFile := func() {
		tmpfile.Close()
		os.Remove(tmpfile.Name())
	}
	return tmpfile, removeFile
}

func assertNoError(t testing.TB, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("didn't expect an error but got one, %v", err)
	}
}
