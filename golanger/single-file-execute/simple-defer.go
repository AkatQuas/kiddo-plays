package main

import (
	"fmt"
)
// The `defer` keyword postpones the execution of a function
// until the surrounding function returns

// It is very important to remember that
// deferred functions are executed in Last In First Out (LIFO) order
// after the return of the surrounding function.

func d1() {
	for i := 3; i > 0; i-- {
		defer fmt.Print("d1-", i, " ")
	}
}

func d2() {
	// The tricky part here is that the deferred anonymous function
	// is evaluated after the for loop ends, because it has no parameters.
	// This means that is evaluated three times for an i value of 0.
	for i := 3; i > 0; i-- {
		defer func() {
			fmt.Print("d2-", i, " ")
		}()
	}
	fmt.Println()
}

func d3() {
	// the best approach to the use of `defer`
    // all the parameters passed to the anonymous function
	// is evaluated at the call of `defer`
	for i := 3; i > 0; i-- {
		defer func(n int) {
			fmt.Print("d3-", n, " ")
		}(i)
	}
}

func main() {
	d1()
	d2()
	fmt.Println()
	d3()
	fmt.Println()
}
