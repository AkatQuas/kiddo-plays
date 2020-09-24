package main

import (
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"time"
)

func gen(min, max int, createNumber chan int, end chan bool) {
	for {
		/*
			Note that the select statements do not require a default branch.

			A select statement is not evaluated sequentially,
			as all of its channels are examined simultaneously.

			If none of the channels in a select statement is ready,
			the select statement will block until one of the channels is ready.

			 If multiple channels of a select statement is ready,
			 then the Go runtime will make a random selection
			 over the set of these ready channels.
			 The Go runtime tries to make this random selection
			 between these ready channels as uniformly and as fairly as possible.
		*/
	    fmt.Println("for loop")
		select {
		case createNumber <- rand.Intn(max-min) + min:
		case <-end:
			close(end)
			return
		case <-time.After(4 * time.Second):
			fmt.Println("\ntime.After()!")
		}
	}
}

func main() {
	rand.Seed(time.Now().Unix())
	createNumber := make(chan int)
	end := make(chan bool)

	if len(os.Args) != 2 {
		fmt.Println("Please give me an integer!")
		return
	}

	n, _ := strconv.Atoi(os.Args[1])
	fmt.Printf("Going to create %d random numbers.\n", n)
	go gen(0, 20*n, createNumber, end)

	for i := 0; i < n * 3; i++ {
		// actually, the `createNumber` is yielding numbers all the time
		// we just print only some of them
		fmt.Printf("receiving: %d\n", <-createNumber)
	}

	time.Sleep(5 * time.Second)
	fmt.Println("Exiting...")
	end <- true
}
