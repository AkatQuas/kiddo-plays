package main

import (
	"fmt"
	"strconv"
	"testing"
)

func CalculateMultiplyByTwo(x int) (result int) {
	result = x * 2
	fmt.Println(strconv.Itoa(result))
	return result
}

func TestMultiplyTable(t *testing.T) {
	tests := []struct {
		input      int
		wantResult int
	}{
		{2, 4},
		{6, 12},
		{-2, -4},
		{9999, 19998},
		{3, 6},
	}
	for _, tt := range tests {
		if gotResult := CalculateMultiplyByTwo(tt.input); gotResult != tt.wantResult {
			t.Errorf("CalculateMultiplyByTwo(%v) = %v, want %v", tt.input, gotResult, tt.wantResult)
		}
	}
}

func TestMultiply(t *testing.T) {
	if CalculateMultiplyByTwo(0) != 0 {
		t.Error("Failed")
	}
}
