package main

import (
    "fmt"
    "os"
    "strconv"
    "sync"
    "time"
)

type Client struct {
    id      int
    integer int
}

type Data struct {
    job    Client
    square int
}

var (
    size    = 10
    clients = make(chan Client, size)
    data    = make(chan Data, size)
)

func worker(w *sync.WaitGroup, i int) {
    j := 0
    for c := range clients {
        fmt.Println("worker", i, "receive job", c.integer)
        square := c.integer * c.integer
        output := Data{c, square}
        data <- output
        j += 1
        time.Sleep(time.Second)
    }
    fmt.Println("worker", i, "finished", j, "jobs")
    w.Done()
}

// makeWP generates the required number of
// worker() goroutines for processing all requests
// `w.Add(1)` function is called in makeWP,
// the `w.Done()` is called in the worker once it has finished its job.
func makeWP(n int) {
    var w sync.WaitGroup
    for i := 0; i < n; i++ {
        w.Add(1)
        go worker(&w, i)
    }
    w.Wait()
    close(data)
}

// create function is to create all requests properly using the Client type
// and then to write them to the clients channel for processing
func create(n int) {
    for i := 0; i < n; i++ {
        c := Client{i, i}
        clients <- c
    }
    close(clients)
}

// readData read data from `data`
// after all data has been read, send a singal to the finished channel
func readData(finished chan<- interface{}) {
    for d := range data {
        fmt.Printf("Client ID: %d\tint:%d\tsquare: %d\n ", d.job.id, d.job.integer, d.square)
    }
    finished <- true
}

// go run workerPool.go 10 4
// go run workerPool.go 4 6
func main() {
    fmt.Println("Capacity of clients:", cap(clients))
    fmt.Println("Capacity of data:", cap(data))

    if len(os.Args) != 3 {
        fmt.Println("Need #jobs and #workers!")
        os.Exit(1)
    }

    nJobs, err := strconv.Atoi(os.Args[1])
    if err != nil {
        fmt.Println(err)
        return
    }

    nWorkers, err := strconv.Atoi(os.Args[2])
    if err != nil {
        fmt.Println(err)
        return
    }

    go create(nJobs)
    finished := make(chan interface{})
    go readData(finished)

    makeWP(nWorkers)
    // the program will not continue until the `finished` channel send out some value
    <-finished
    fmt.Printf("All jobs done\n")
}
