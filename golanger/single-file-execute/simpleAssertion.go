package main

import (
    "fmt"
)

func main() {
    var myInt interface{} = 123

    k, ok := myInt.(int)
    if ok {
        fmt.Println("Success:", k)
    }

    if v, ok := myInt.(float64); ok {
        fmt.Println(v)
    } else {
        fmt.Println("Failed without panicking!")
    }

    i := myInt.(int)
    fmt.Println("No cheking:", i)

    j := myInt.(bool)
    fmt.Println(j)
}
