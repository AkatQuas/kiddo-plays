package main

import (
    "fmt"
    "math/rand"
    "strconv"
    "sync"
    "time"
)

func main() {
    usingTimeToControl()
    usingChannelToControl()
    var p int
    for i := 0; i < 5; i++ {
       go sleepyChanger(&p)
    }
    time.Sleep(4 * time.Second)
    fmt.Println("after change p is", p)
}

func usingTimeToControl() {
    fmt.Println("timeControl starts")

    for i := 0; i < 5; i++ {
        go sleepyGopher("k" + strconv.Itoa(i))
    }
    go sleepyGopher("s")
    time.Sleep(4 * time.Second)
    fmt.Println("timeControl ends")
}

func usingChannelToControl() {
    fmt.Println("channelControl starts")
    // using channel to exit program
    c := make(chan int)

    for i := 0; i < 5; i++ {
        go sleepyGopherWithChannel(i, c)
    }
    fmt.Println("channelControl routines are all set")
    timeout := time.After(3 * time.Second)
    for i := 5; i > 0; i-- {
        fmt.Println("channelControl waiting for channel")
        select {
        case gopherID := <-c:
            fmt.Println("gopher", gopherID, "has waken up")
        case <-timeout:
            fmt.Println("My patience ran out")
            return
        }
    }
    /*
    	for i := 5; i > 0; i-- {
    		// this will trigger deadlock
    		// all goroutines are asleep
    		// avoid this
    		gopherID := <-c
    		fmt.Println("again, gopher", gopherID, "has woken up")
    	}
    */
    fmt.Println("channelControl ends")
}

func sleepyGopher(s string) {
    time.Sleep(3 * time.Second)
    fmt.Println("...snore...", s)
}

func sleepyChanger(i *int) {
    time.Sleep(2 * time.Second)
    generated := rand.Intn(18)
    *i = generated
    fmt.Println("generated", generated, "i is", *i)
}

func sleepyGopherWithChannel(id int, c chan int) {
    time.Sleep(time.Duration(rand.Intn(4000)) * time.Millisecond)
    fmt.Println("...", id, "snore...")
    c <- id
}

// Visited tracks whether web pages have been visited.
// Its methods may be used concurrently from multiple goroutines.
type Visited struct {
    // mu guards the `visited` map
    mu      sync.Mutex
    visited map[string]int
}

func (v *Visited) VisitLink(url string) int {
    v.mu.Lock()

    defer v.mu.Unlock()

    count := v.visited[url]
    count++
    v.visited[url] = count
    return count
}
