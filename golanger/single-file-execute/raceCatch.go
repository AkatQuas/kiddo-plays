package main

import (
    "fmt"
    "os"
    "strconv"
    "sync"
)

/*
go run -race raceCatch.go 10
go run raceCatch.go 10
*/
func main() {
    arguments := os.Args
    if len(arguments) != 2 {
        fmt.Println("Give me a natural number!")
        os.Exit(1)
    }
    numGR, err := strconv.Atoi(os.Args[1])
    if err != nil {
        fmt.Println(err)
        return
    }

    var waitGroup sync.WaitGroup
    var aMutex sync.Mutex
    var i int

    k := make(map[int]int)
    k2 := make(map[int]int)
    k[1] = 12

    /*
    	The first data race happens inside anonymous `func()`,
    	which is called by the `for` loop that is called by a goroutine.
    	The problem here is signified by the Previous write message.
    	After examining the related code, it is easy to see that
    	the actual problem is that the anonymous function takes no parameters,
    	which means that the value of `i` that is used in the `for` loop cannot
    	be deterministically discerned, as it keeps changing due to the `for` loop,
    	which is a write operation.
    */
    for i = 0; i < numGR; i++ {
        waitGroup.Add(1)
        go func(j int) {
            defer waitGroup.Done()
            fmt.Println("k  round", j, "write to k using", i)
            k[i] = i
            fmt.Println("k  round", j, "after write is", i)
        }(i)
    }

    for i = 0; i < numGR; i++ {
        waitGroup.Add(1)
        go func(j int) {
            defer waitGroup.Done()
            fmt.Println("k2 round", j, "write to k2 using", j)
            /*
                without `aMutex`,
                this anonymous function will cause race again
            */
            aMutex.Lock()
            k2[j] = j
            aMutex.Unlock()
            fmt.Println("k2 round", j, "write to k2 using", j)
        }(i)
    }

    waitGroup.Wait()
    // until all goroutine ends, we try to mutate the value
    k[2] = 10
    k2[2] = 10
    fmt.Printf("k = %#v\n", k)
    fmt.Printf("k2 = %#v\n", k2)
}
