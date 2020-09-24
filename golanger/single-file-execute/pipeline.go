package main

import (
    "fmt"
    "strings"
)

func main() {
    c0 := make(chan string)
    c1 := make(chan string)
    go sourceGopher(c0)
    go filterGopher(c0, c1)
    printGopher(c1)
}

func sourceGopher(downstream chan string) {
    for _, v := range []string {"hello world", "a bad banana", "goodbye all"} {
        downstream <- v
    }
    close(downstream)
}

func filterGopher(upstream, downstream chan string) {
    /*
    // simple iteration
    for {
        item, ok := <-upstream
        if !ok {
            close(stream)
            return
        }
        if !strings.Contains(item, "bad") {
            downstream <- item
        }
    }
    */
    for item := range upstream {
        if !strings.Contains(item, "bad") {
            downstream <- item
        }
    }
    close(downstream)
}

func printGopher(upstream chan string)  {
   for v := range upstream {
       fmt.Println(v)
   }
}