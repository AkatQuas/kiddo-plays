package main

import (
    "fmt"
    "sync"
    "time"
)

func main() {
    timeout1()
    timeout2()
}

func timeout1() {
    c1 := make(chan string)
    go func() {
        time.Sleep(time.Second * 3)
        c1 <- "c1 OK"
    }()

    fmt.Println("Before select for c1")
    select {
    case res := <-c1:
        fmt.Println("receive data from channel c1", res)
    case <-time.After(time.Second * 1):
        fmt.Println("timeout c1, discard value in channel c1")
    }
    fmt.Println("After select for c1")

    c2 := make(chan string)
    go func() {
        time.Sleep(3 * time.Second)
        c2 <- "c2 OK"
    }()

    fmt.Println("Before select for c2")
    select {
    case res := <-c2:
        fmt.Println("receive data from channel c2", res)
    case <-time.After(4 * time.Second):
        fmt.Println("timeout c2, discard value in channel c2")
    }
    fmt.Println("After select for c2")
}

func timeout(w *sync.WaitGroup, t time.Duration) bool {
	temp := make(chan int)
	go func() {
		time.Sleep(5 * time.Second)
		defer close(temp)
        w.Wait()
        fmt.Println("though timeout has returned, the anonymous function still running to its own end")
	}()

	select {
	case <-temp:
		return false
	case <-time.After(t):
		return true
	}
}

func timeout2() {
    var w sync.WaitGroup
    w.Add(1)

    t := 10000

    duration := time.Duration(int32(t)) * time.Millisecond
    fmt.Printf("Timeout period is %s\n", duration)

    fmt.Println("Before first wait")
    if timeout(&w, duration) {
        fmt.Println("first wait timeout -> Timed out!")
    } else {
        fmt.Println("first wait timeout -> OK!")
    }
    fmt.Println("After first wait")

    w.Done()
    t = 6000
    duration = time.Duration(int32(t)) * time.Millisecond
    fmt.Printf("Timeout period is %s\n", duration)
    fmt.Println("Before second wait")
    // there's nothing to wait in the second invocation
    if timeout(&w, duration) {
        fmt.Println("second wait timeout -> Timed out!")
    } else {
        fmt.Println("second wait timeout -> OK!")
    }
    fmt.Println("After second wait")
	time.Sleep(10 * time.Second)
    fmt.Println("timeout2 exit")
}
