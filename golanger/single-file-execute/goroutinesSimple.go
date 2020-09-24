package main

import (
	"fmt"
	"time"
)

func function() {
	for i := 0; i < 10; i++ {
		fmt.Println("func->", i)
	}
	fmt.Println()
}

func main() {
	simple()
	multiple()
}

func simple() {
	// don't trust the execution order
	go function()

	go func() {
		for i := 10; i < 20; i++ {
			fmt.Println("anonymous->", i, " ")
		}
	}()

	time.Sleep(1 * time.Second)
}

func multiple() {
	count := 10
	fmt.Printf("Going to create %d goroutines.\n", count)
	for i := 0; i < count; i++ {
			go func(x int) {
					fmt.Printf("%d ", x)
			}(i)
	}

	// Naively, The purpose of the time.Sleep() statement is to
	// give the goroutines enough time to finish their jobs
	// so that their output can be seen on the screen.
	time.Sleep(time.Second)
	fmt.Println("\nExiting...")
}
