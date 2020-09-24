package main

import (
	"fmt"
)

type subject struct {
	id   int
	name string
}

func (s subject) String() string {
	panic("implement me")
}

func main() {
	subj := subject{name: "world"}
	sayHi(subj)
}

func sayHi(s fmt.Stringer) {
	fmt.Printf("hello %s", s)
}
