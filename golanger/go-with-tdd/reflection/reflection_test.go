package reflection

import (
	"reflect"
	"testing"
)

type Person struct {
	Name    string
	Profile Profile
}

type Profile struct {
	Age  int
	City string
}

func TestWalk(t *testing.T) {
	t.Run("execute once", func(t *testing.T) {
		want := "42"
		x := struct {
			Name string
		}{want}

		var got []string
		Walk(x, func(input string) {
			got = append(got, input)
		})
		if len(got) != 1 {
			t.Errorf("wrong number of functions calls, got %d want %d", len(got), 1)
		}
		if got[0] != want {
			t.Errorf("got %q, want %q", got[0], want)
		}
	})
	t.Run("complex structure", func(t *testing.T) {
		cases := []struct {
			Name          string
			Input         interface{}
			ExpectedCalls []string
		}{
			{
				"struct with only one field",
				struct {
					Name string
				}{"42"},
				[]string{"42"},
			},
			{
				"struct with two fields",
				struct {
					Name string
					City string
				}{"42", "world"},
				[]string{"42", "world"},
			},
			{
				"struct with non string field",
				struct {
					Name string
					Age  int
				}{"42", 42},
				[]string{"42"},
			},
			{
				"Nested fields",
				struct {
					Name    string
					Profile struct {
						Age  int
						City string
					}
				}{"42", struct {
					Age  int
					City string
				}{42, "world"}},
				[]string{"42", "world"},
			},
			{
				"nested with reference",
				&Person{
					"42",
					Profile{42, "world"},
				},
				[]string{"42", "world"},
			},
			{
				"Slices",
				[]Profile{
					{33, "world"},
					{40, "jera"},
				},
				[]string{"world", "jera"},
			},
			{
				"Arrays",
				[2]Profile{
					{33, "world"},
					{40, "jera"},
				},
				[]string{"world", "jera"},
			},
		}
		for _, test := range cases {
			t.Run(test.Name, func(t *testing.T) {
				var got []string

				Walk(test.Input, func(input string) {
					got = append(got, input)
				})
				if !reflect.DeepEqual(got, test.ExpectedCalls) {
					t.Errorf("got %v, want %v", got, test.ExpectedCalls)
				}
			})
		}
	})
	t.Run("with maps", func(t *testing.T) {

		aMap :=
			map[string]string{
				"Foo": "42",
				"Bar": "world",
			}
		var got []string
		Walk(aMap, func(input string) {
			got = append(got, input)
		})
		assertContains(t, got, "42")
		assertContains(t, got, "world")
	})
	t.Run("with channels", func(t *testing.T) {
		aChannel := make(chan Profile)
		go func() {
			aChannel <- Profile{42, "world"}
			aChannel <- Profile{42, "42"}
			close(aChannel)
		}()
		var got []string
		want := []string{"world", "42"}
		Walk(aChannel, func(input string) {
			got = append(got, input)
		})
		if !reflect.DeepEqual(got, want) {
			t.Errorf("got %v, want %v", got, want)
		}
	})
	t.Run("with functions", func(t *testing.T) {
		aFunction := func() (Profile, Profile) {
			return Profile{42, "world"}, Profile{42, "42"}
		}
		var got []string
		want := []string{"world", "42"}
		Walk(aFunction, func(input string) {
			got = append(got, input)
		})
		if !reflect.DeepEqual(got, want) {
			t.Errorf("got %v, want %v", got, want)
		}
	})
}

func assertContains(t testing.TB, haystack []string, needle string) {
	t.Helper()
	contains := false
	for _, x := range haystack {
		if x == needle {
			contains = true
		}
	}
	if !contains {
		t.Errorf("expected %+v to contain %q but it didn't", haystack, needle)
	}
}
