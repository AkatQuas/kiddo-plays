package dictionary

import "testing"

func TestUpdate(t *testing.T) {
	t.Run("exist word", func(t *testing.T) {
		key := "test"
		dictionary := Dictionary{
			key: "a plain test",
		}
		want := "a new test"
		err := dictionary.Update(key, want)

		assertNoError(t, err)
		assertDefinition(t, dictionary, key, want)
	})

	t.Run("new word", func(t *testing.T) {
		dictionary := Dictionary{
			"test": "a plain test",
		}
		err := dictionary.Update("not-word", "anything")
		assertError(t, err, ErrNotFound)
	})
}

func TestAdd(t *testing.T) {
	t.Run("new word", func(t *testing.T) {
		dictionary := Dictionary{}
		key := "test"
		want := "a plain test"
		err := dictionary.Add(key, want)

		assertNoError(t, err)
		assertDefinition(t, dictionary, key, want)
	})

	t.Run("existing word", func(t *testing.T) {
		key := "test"
		definition := "a plain test"
		dictionary := Dictionary{key: definition}
		err := dictionary.Add(key, "new want")
		assertErrorExist(t, err)
		assertDefinition(t, dictionary, key, definition)
	})
}

func TestDelete(t *testing.T) {
	word := "test"
	dictionary := Dictionary{word: "a plain test"}

	dictionary.Delete(word)

	_, err := dictionary.Search(word)
	assertError(t, err, ErrNotFound)
}

func TestSearch(t *testing.T) {
	dictionary := Dictionary{"test": "a plain dict"}
	t.Run("known word", func(t *testing.T) {
		want := "a plain dict"
		assertDefinition(t, dictionary, "test", want)
	})
	t.Run("unknown word", func(t *testing.T) {
		_, err := dictionary.Search("unknown")
		// assertErrorExist(t, err)
		assertError(t, err, ErrNotFound)
	})
}

func TestPlainSearch(t *testing.T) {
	dictionary := map[string]string{"test": "a plain test"}

	got := Search(dictionary, "test")
	want := "a plain test"

	// t.Errorf("got %q want %q. search key %q in given %#v", got, want, "test", dictionary)
	assertStringEqual(t, got, want)
}

func assertDefinition(t testing.TB, dictionary Dictionary, word, definition string) {
	t.Helper()

	got, err := dictionary.Search(word)

	assertNoError(t, err)
	assertStringEqual(t, got, definition)
}

func assertStringEqual(t testing.TB, got, want string) {
	t.Helper()
	if got != want {
		t.Errorf("got %q want %q", got, want)
	}
}

func assertNoError(t testing.TB, got error) {
	t.Helper()
	if got != nil {
		t.Fatal("got an error but didn't want one")
	}
}

func assertErrorExist(t testing.TB, got error) {
	t.Helper()
	if got == nil {
		t.Fatal("wanted an error but didn't get one")
	}
}

func assertError(t testing.TB, got error, want error) {
	t.Helper()
	assertErrorExist(t, got)
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}
