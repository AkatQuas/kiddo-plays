package main

import (
    "fmt"
    "strings"
)

type talker interface {
    talk() string
}

type martian struct{}

func (m martian) talk() string {
    return "nack nack"
}

type laser int

func (l laser) talk() string {
    return strings.Repeat("pew ", int(l))
}

func shout(t talker) {
    louder := strings.ToUpper(t.talk())
    fmt.Printf("%T talks: %v\n", t, louder)
}

/*
- Embedding gives access to the fields of inner structures in the outer structure.
- Methods are automatically forwarded when you embed types in a structure.
*/
type starship struct {
    laser // embedding
}

type rover string

func (r rover) talk() string {
    return string(r)
}

type stardater interface {
    YearDay() int
    Hour() int
}

type person struct {
    name, superpower string
    age              int
}

func demolish(planets *map[string]string) {}

func (p *person) birthday() {
    p.age++
}

func main() {
    var t interface {
        talk() string
    }
    t = martian{}
    fmt.Printf("%T, %[1]v\n", t)
    shout(&martian{})
    shout(t)

    t = laser(3)
    shout(t)

    s := starship{laser(5)}
    // Embedding `laser` gives the `starship` a `talk` method that forwards to the `laser`.
    // Now the `starship` also satisfies the `talker` interfac`, allowing it to be used with `shout`.
    shout(s)

    r := rover("whir whir")
    shout(r)

    // a pointer to person struct
    timmy := &person{
        name: "Timothy",
        age:  10,
    }
    timmy.birthday()

    fmt.Printf("%T, %[1]v \n", timmy)
}
