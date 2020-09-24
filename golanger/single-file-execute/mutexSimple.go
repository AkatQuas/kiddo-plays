package main

import (
    "fmt"
    "sync"
    "time"
)

var (
    /*
    	All of the interesting work is being done by the `sync.Lock()` and `sync.Unlock()`
    	functions that can lock and unlock a `sync.Mutex` mutex, respectively.
    */
    m  sync.Mutex
    v1 int
)

func change(i int) {
    // The critical section of this function is the Go code
    // between the `m.Lock()` and `m.Unlock()` statements.
    m.Lock()
    fmt.Println("Change triggered by index:", i)
    // as you can see, the trigger in random
    // but `v1` increment is done step by step
    time.Sleep(time.Second)
    v1 = v1 + 1
    m.Unlock()
}

func read() int {
    m.Lock()
    a := v1
    m.Unlock()
    return a
}

func main() {
    numGR := 9
    var waitGroup sync.WaitGroup

    fmt.Printf("starting result -> %d\n", read())
    for i := 0; i < numGR; i++ {
        waitGroup.Add(1)
        go func(i int) {
            fmt.Printf("in go %d\n", i)
            defer waitGroup.Done()
            change(i)
            fmt.Printf("read result -> %d\n", read())
        }(i)
    }

    waitGroup.Wait()
    fmt.Printf("finally result -> %d\n", read())
}
