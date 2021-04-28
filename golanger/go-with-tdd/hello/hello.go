package main

import (
	"fmt"
)

const french = "French"
const spanish = "Spanish"
const englishPrefix = "Hello, "
const spanishPrefix = "Hola, "
const frenchPrefix = "Bonjour, "

func Hello(name string, locale string) string {
	if name == "" {
		name = "42"
	}
	return greetingPrefix(locale) + name
}

func greetingPrefix(locale string) (prefix string) {
	switch locale {
	case french:
		prefix = frenchPrefix
	case spanish:
		prefix = spanishPrefix
	default:
		prefix = englishPrefix
	}
	return
}

func main() {
	fmt.Println(Hello("", ""))
}
