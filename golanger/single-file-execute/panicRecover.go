package main

import (
	"fmt"
	"os"
)

// Strictly speaking, `panic()` is a built-in Go function
// that terminates the current flow of a Go program and starts panicking!
// On the other hand, the `recover()` function, which is also a built-in Go function,
// allows you to take back the control of a goroutine that just panicked using `panic()`.

func fa() {
	fmt.Println("Inside a()")
	defer func() {
		if c := recover(); c != nil {
			fmt.Println("Recover inside a()!")
		}
	}()
	fmt.Println("About to call b()")
	fb()
	// unreachable code because of the `panic` in `fb`
	// stop the execution flow from here
	fmt.Println("b() exited!")
	fmt.Println("Exiting a().")
}

func fb() {
	fmt.Println("Inside b()")
	panic("Panic in b()!")
	// unreachable code because of the `panic`
	fmt.Println("Exiting b()")
}

func justPanic() {
	if len(os.Args) == 1 {
		panic("Not enough arguments!")
	}

	fmt.Println("Thanks for the argument(s)!")
}

func main() {
	fa()
	fmt.Println("main() going to panic!")
	justPanic()
	fmt.Println("main() maybe after panic!")
}
