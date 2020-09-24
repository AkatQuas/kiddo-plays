package main

import (
    "fmt"
    "math/rand"
    "time"
)

func main() {
    bufferedChannel()
    nilChannel()
    channelSquare()
}

func bufferedChannel() {
    // `numbers` channel has room for only 5 integers,
    // You can't put all 10 integers in it.
    numbers := make(chan int, 5)
    counter := 10

    for i := 0; i < counter; i++ {
        select {
        case numbers <- i:
        default:
            fmt.Println("Not enough space for", i)
        }
    }

    for i := 0; i < counter+5; i++ {
        select {
        case num := <-numbers:
            fmt.Println("index", i, "with num", num)
        default:
            fmt.Println("index", i, "Nothing more to be done!")
        }
    }
}

func nilChannel() {
    add := func(c chan int) {
        sum := 0
        t := time.NewTimer(time.Millisecond * 10)

        for {
            select {
            case input := <-c:
                sum = sum + input

            /*
               When the time expires, the timer sends a value to the `t.C` channel.
               This will trigger the execution of the relevant branch of the `select` statement,
               which will assign the `nil` value to the `c` channel and print the `sum` variable.
            */
            case <-t.C:
                c = nil
                fmt.Println(sum)
            }
        }
    }

    send := func(c chan int) {
        // generate random numbers and continue sending
        // them to a channel for as long as the channel is open
        for {
            num := rand.Intn(10)
            fmt.Println("yielding", num)
            c <- num
        }
    }

    c := make(chan int)
    go add(c)
    go send(c)

    time.Sleep(3 * time.Second)
}

func channelSquare() {
    f1 := func(cc chan chan int, f chan bool) {
        c := make(chan int)
        cc <- c
        defer close(c)

        sum := 0
        select {

        // read data from the regular int channel
        case x := <-c:
            for i := 0; i <= x; i++ {
                sum = sum + i
            }
            c <- sum
            c <- sum

        // exit function using the f signal channel.
        case <-f:
            return
        }
    }

    times := 10

    cc := make(chan chan int)

    for i := 1; i < times+1; i++ {
        f := make(chan bool)
        go f1(cc, f)
        ch := <-cc
        fmt.Println("channel at different address",&ch)
        ch <- i
        for sum := range ch {
            fmt.Println("Sum(", i, ")=", sum)
        }
        fmt.Println()
        time.Sleep(time.Second)
        close(f)
    }
}
