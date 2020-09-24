package main

import (
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"sync"
	"time"
)

// the readChannel channel is used for reading the random numbers
var readChannel = make(chan int)

// the writeChannel channel is used for getting new random numbers
var writeChannel = make(chan int)

func set(newValue int) {
	writeChannel <- newValue
}

func read() int {
	return <-readChannel
}

// monitor has a shared variable `value`,
// you can access to it via two helper channel,
// one channel is the writeChannel to set the value,
// the other is the readChannel to read the value.
// This is a good way to implement the shared memory
// among goroutines using goroutine and channels
func monitor() {
	var value int
	fmt.Println("initial value", value)
	for {
		select {
		case newValue := <-writeChannel:
			value = newValue
			fmt.Printf("receive %d\n", value)
		case <- time.After(time.Millisecond * 50):
			fmt.Println("timeout in monitor")
			break
		case readChannel <- value:
		    fmt.Printf("put value %d into readChannel\n", value)
		}
	}
}

func main() {
	if len(os.Args) != 2 {
		fmt.Println("Please give an integer!")
		return
	}
	n, err := strconv.Atoi(os.Args[1])
	if err != nil {
		fmt.Println(err)
		return
	}

	fmt.Printf("Going to create %d random numbers.\n", n)
	rand.Seed(time.Now().Unix())
	go monitor()
	var w sync.WaitGroup

	for r := 0; r < n; r++ {
		w.Add(1)
		go func() {
			defer w.Done()
			set(rand.Intn(10 * n))
		}()
	}

	// go func() {
	//     w.Add(1)
	// 	var v int
	// 	for {
	// 		select {
	// 		case <- time.After(time.Millisecond * 100):
	// 			w.Done()
	// 			break;
	// 		case v = <-readChannel:
	// 			fmt.Println("read from ", v)
	// 		}
	// 	}
	// }()
	w.Wait()
	fmt.Printf("\nLast value: %d\n", read())
}
