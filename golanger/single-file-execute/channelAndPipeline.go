package main

import (
    "fmt"
    "math/rand"
    "os"
    "strconv"
    "time"
)

var CLOSEA = false

var DATA = make(map[int]bool)

func random(min, max int) int {
    return rand.Intn(max-min) + min
}

func first(min, max int, out chan<- int) {
    for {
        if CLOSEA {
            close(out)
            return
        }
        out <- random(min, max)
    }
}

func second(out chan<- int, in <-chan int) {
    for x := range in {
        fmt.Print(x, " ")
        _, ok := DATA[x]
        if ok {
            CLOSEA = true
        } else {
            DATA[x] = true
            out <- x
        }
    }
    fmt.Println()
    close(out)
}

func third(in <-chan int) {
    var sum int
    sum = 0
    // this is blocking
    for x2 := range in {
        sum = sum + x2
    }
    fmt.Printf("The sum of the random numbers is %d\n", sum)
}

func pipeline() {
    if len(os.Args) != 3 {
        fmt.Println("Need two integer parameters!")
        os.Exit(1)
    }

    n1, _ := strconv.Atoi(os.Args[1])
    n2, _ := strconv.Atoi(os.Args[2])

    if n1 > n2 {
        fmt.Printf("%d should be smaller than %d\n", n1, n2)
        return
    }

    rand.Seed(time.Now().UnixNano())
    A := make(chan int)
    B := make(chan int)

    // the `first` would generate some random number
    // and put it into the channel `A`,
    // the `second` would extract number from `A`,
    // check whether it exist while put it into channel `B`.
    // the `third` would accumulate the sum from `B`
    go first(n1, n2, A)
    go second(B, A)
    third(B)
}

func main() {
    pipeline()
    simpleChannel()
}

func writeToChannel(c chan int, x int) {
    fmt.Println("start write to channel->", x)
    c <- x
    close(c)
    fmt.Println("after close->", x)
}

func simpleChannel() {
    /*
    	the stdout output is not deterministic
    */

    c := make(chan int)
    go writeToChannel(c, 10)
    time.Sleep(1 * time.Second)
    fmt.Println("Read:", <-c)
    time.Sleep(1 * time.Second)

    _, ok := <-c
    if ok {
        fmt.Println("Channel is open!")
    } else {
        fmt.Println("Channel is closed!")
    }
}
