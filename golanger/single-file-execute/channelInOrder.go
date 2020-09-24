package main

import (
	"fmt"
	"time"
)

func A(a, b chan struct{}) {
	fmt.Println("A() before channel!")
	<-a // `A()` would be blocked until receiving data from channel `a`
	fmt.Println("A()!")
	time.Sleep(time.Second)
	close(b)
}

func B(a, b chan struct{}) {
	fmt.Println("B() before channel!")
	<-a // not until the channel `a` send some data will the `B()` would continue to execute
	fmt.Println("B()!")
	close(b)
}

func C(a chan struct{}) {
	fmt.Println("C() before channel!")
	<-a
	fmt.Println("C()!")
}

func main() {
    /*
		the order of these "before" output is not deterministic
		the order of these "?()!" is deterministic.
		A()! -> B()! -> C()! -> C()! -> C()!

		some real world output:
		---
			B() before channel!
			C() before channel!
			C() before channel!
			C() before channel!
			A() before channel!
			A()!
			B()!
			C()!
			C()!
			C()!
		---
			A() before channel!
			A()!
			B() before channel!
			C() before channel!
			C() before channel!
			C() before channel!
			B()!
			C()!
			C()!
			C()!
		---
	*/
	x := make(chan struct{})
	y := make(chan struct{})
	z := make(chan struct{})

	go C(z)
	go A(x, y)
	go C(z)
	go B(y, z)
	go C(z)

	close(x)
	// x <- struct{}{}
	time.Sleep(3 * time.Second)
}
