package main

import (
	"fmt"
)

func main() {
	err := greet("Hello", "gophers")
	fmt.Println(err)
}

func greet(how string, who string) error {
	_, err := fmt.Printf("%s %s!", how, who)
	return err
}
