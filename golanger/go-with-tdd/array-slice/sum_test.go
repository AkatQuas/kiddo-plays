package main

import (
	"reflect"
	"testing"
)

func TestSum(t *testing.T) {
	numbers := []int{1, 3, 87, 49, 72}

	got := Sum(numbers)
	want := 212

	if got != want {
		t.Errorf("got %d want %d given, %v", got, want, numbers)
	}
}

func TestSumAll(t *testing.T) {
	got := SumAll([]int{9, 8}, []int{12, 48})

	want := []int{17, 60}

	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %v want %v", got, want)
	}
}

func TestSumAllTails(t *testing.T) {
	checkSums := func(t testing.TB, got []int, expected []int) {
		t.Helper()
		if !reflect.DeepEqual(got, expected) {
			t.Errorf("got %v want %v", got, expected)
		}
	}

	t.Run("make the sums of some slices", func(t *testing.T) {
		got := SumAllTails([]int{1, 8, 4}, []int{2, 9, 8})
		expected := []int{12, 17}
		checkSums(t, got, expected)
	})

	t.Run("safely sum empty slices", func(t *testing.T) {
		got := SumAllTails([]int{}, []int{3, 4, 5, 18})
		expected := []int{0, 27}

		checkSums(t, got, expected)
	})

}
