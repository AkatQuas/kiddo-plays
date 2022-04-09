package main

import (
	"fmt"
	"os"
)

func check(e error) {
	if e != nil {
		panic(e)
	}
}

func main() {
	fmt.Println("Hello, 42!")
	dat, err := os.ReadFile("src/cow.txt")
	check(err)
	fmt.Print(string(dat))
	dat, err = os.ReadFile("../ascii/assets/cow.txt")
	check(err)
	fmt.Print(string(dat))
}
