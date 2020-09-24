package main

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"
)

func f1(t int) {
	//  call the `context.Background()` function
	//  to initialize an empty `Context` parameter
	c1 := context.Background()
	// `context.WithCancel()` function uses an existing Context
	// and creates a child of it with cancellation
	// it also creates a `Done` channel that can be closed,
	// either when the `cancel()` function is called,
	//  or when the `Done` channel of the parent context is closed.
	c1, cancel := context.WithCancel(c1)
	defer cancel()

	go func() {
		time.Sleep(4 * time.Second)
		fmt.Println("withCancel -> Cancel called")
		cancel()
	}()

	select {
		// The use of the `Done()` function of a `Context` variable.
		// When this function is called, there's a cancellation.
		// The return value is a channel,
		// when `cancel()` is called, signal can be received
	case <-c1.Done():
		fmt.Println("withCancel Done -> f1():", c1.Err())
		return
	case r := <-time.After(time.Duration(t) * time.Second):
		fmt.Println("withCancel timeout -> f1():", r)
	}
	return
}

func f2(t int) {
	c2 := context.Background()

	// WithTimeout returns `WithDeadline(parent, time.Now().Add(timeout))`.
	// When the timeout period expires, the `cancel()` function is automatically called.
	// But you can invoke the `cancel()` function programmatically
	c2, cancel := context.WithTimeout(c2, time.Duration(t)*time.Second)
	defer cancel()

	// programmatically call the `cancel()` function
	// go func() {
	// 	time.Sleep(4 * time.Second)
	// 	cancel()
	// }()

	select {
	case <-c2.Done():
		fmt.Println("withTimeout Done -> f2():", c2.Err())
		return
	case r := <-time.After(time.Duration(t * 2) * time.Second):
		fmt.Println("withTimeout timeout -> f2():", r)
	}
	return
}

func f3(t int) {
	c3 := context.Background()
	deadline := time.Now().Add(time.Duration(2*t) * time.Second)
	// deadline has the type `time.Time`
	//  When the deadline passes, the `cancel()` function is automatically called.
	c3, cancel := context.WithDeadline(c3, deadline)
	defer cancel()

	go func() {
		time.Sleep(4 * time.Second)
		cancel()
	}()

	select {
	case <-c3.Done():
		fmt.Println("withDeadline Done -> f3():", c3.Err())
		return
	case r := <-time.After(time.Duration(t) * time.Second):
		fmt.Println("withDeadline timeout -> f3():", r)
	}
	return
}

func main() {
	if len(os.Args) != 2 {
		fmt.Println("Need a delay!")
		return
	}

	delay, err := strconv.Atoi(os.Args[1])
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Println("Delay:", delay)

	f1(delay)
	f2(delay)
	f3(delay)
}
