package main

import (
    f "fmt"
    "math/rand"
)

func main() {
    usingRandom()
}

func usingRandom() {
    for i := 0; i < 10; i++ {
        num := rand.Intn(25)
        println(num)
        f.Printf("%d) %d\n", i, num)
    }
}
