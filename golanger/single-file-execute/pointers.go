package main

import (
    "fmt"
    "sort"
)

func main() {
    simplePointer()
    changeCreatureViaCopy()
    changeCreatureViaPointer()
    fmt.Printf("func is an implicit pointer %v\n", simplePointer)
    doSort()
}

func getPointer(n *int) {
	*n = *n * *n

}

func returnPointer(n int) *int {
	v := n * n
	return &v
}

func simplePointer() {
    creature := "Shark"
    pointer := &creature
    fmt.Println("creature =", creature)
    fmt.Println("pointer =", pointer)
    fmt.Println("using dereferencing, *pointer =", *pointer)

    // modify the value in that memory address
    *pointer = "Sammy"
    fmt.Println("creature =", creature)
    fmt.Println("pointer =", pointer)
    fmt.Println("using dereferencing, *pointer =", *pointer)

    var creature2 *Creature
    fmt.Println("Empty creature=", creature2)

    var fn func(a, b int) int

    fmt.Printf("fn is a nil function, %v %v\n", fn, fn == nil)
}

type Creature struct {
    Species string
}

func (c *Creature) Reset() {
    c.Species = ""
}

func changeCreatureViaCopy() {
    change := func(creature Creature, species string) {
        creature.Species = species
        fmt.Printf("2) %+v\n", creature)
    }

    creature := Creature{Species: "shark"}
    fmt.Printf("1) %+v\n", creature)

    change(creature, "jellyfish")
    fmt.Printf("3) %+v\n", creature)
    creature.Reset()
    fmt.Printf("4) %+v\n", creature)
}

func changeCreatureViaPointer() {
    change := func(creature *Creature, species string) {
        if creature == nil {
            fmt.Println("creature is nil")
            return
        }
        creature.Species = species
        fmt.Printf("2) %+v\n", creature)
    }

    creature := Creature{Species: "shark"}
    fmt.Printf("1) %+v\n", creature)

    change(&creature, "jellyfish")
    fmt.Printf("3) %+v\n", creature)
    creature.Reset()
    fmt.Printf("4) %+v\n", creature)
}

func sortStrings(s []string, less func(i, j int) bool) {
    if less == nil {
        less = func(i, j int) bool { return s[i] < s[j] }
    }
    sort.Slice(s, less)
}

func doSort() {
    food := []string{"onion", "carrot", "celery"}
    fmt.Println("before sort", food)
    sortStrings(food, nil)
    fmt.Println("after sort", food)

    sortStrings(food, func(i, j int) bool { return len(food[i]) < len(food[j]) })
    fmt.Println("after sort by length", food)
}
