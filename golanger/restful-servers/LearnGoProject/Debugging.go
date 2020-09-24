package main

import "runtime"

func main() {
	_ = Factorial(10, false)
	runtime.Breakpoint()
	println("ok")
}

func Factorial(n int, withBreak bool) int {
	if withBreak {
		runtime.Breakpoint()
	}
	if n == 0 {
		return 1
	} else {
		return n * Factorial(n - 1, withBreak)
	}
}
