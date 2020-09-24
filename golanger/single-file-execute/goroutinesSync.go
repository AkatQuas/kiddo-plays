package main

import (
	"flag"
	"fmt"
	"sync"
)

func main() {
	n := flag.Int("n", 20, "Number of goroutines")
	flag.Parse()
	count := *n
	fmt.Printf("Going to create %d goroutines.\n", count)

	var waitGroup sync.WaitGroup
	fmt.Printf("%#v\n", waitGroup)
	for i := 0; i < count; i++ {
		waitGroup.Add(1)
		// don't trust the execution order
		// it's only about a signal to the goroutine end
		go func(x int) {
			defer waitGroup.Done()
			fmt.Printf("%d ", x)
		}(i)
	}

	fmt.Printf("%#v\n", waitGroup)
	/*
		if more `Add()` than `Done()`, the program will go into deadlock
		if less `Add()` than `Done()`, the program will panic with `negative WaitGroup counter`
	*/
	waitGroup.Wait()
	fmt.Println("\nExiting...")
}
