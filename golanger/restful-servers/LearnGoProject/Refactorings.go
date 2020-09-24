package main

import (
	"fmt"
)

type subject struct {
	id   int
	name string
}

func main() {
	subj := subject{name: "world"}
	funcName(subj)
}

func funcName(subj subject) (int, error) {
	return fmt.Printf("hello %s", subj.name)
}
