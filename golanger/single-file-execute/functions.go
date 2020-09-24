package main

import (
    "fmt"
    "math/rand"
    "strings"
    "time"
)

func main() {
    checkVowel()
    if val, err := repeatString("Sammy", 5); err != nil {
        fmt.Println("repeat with error", err)
    } else {
        fmt.Println("repeation is", val)
    }
    if val, err := repeatString("Sammy", 0); err != nil {
        fmt.Println("repeat with error", err)
    } else {
        fmt.Println("repeation is", val)
    }
    addNumbers(1, 2, 4)
    fmt.Println("doubled 4 is", doubleInt(4))
    loopFive()

    sayHello()
    sayHello("Sammy")
    sayHello("Sammy", "Jessica", "Drew")

    fmt.Println(join("&", []string{"Sammy", "Jessica", "Drew", "Jamie"}))
    fmt.Println(join("->", []string{"Sammy", "Jessica"}))
    fmt.Println(join(";", []string{"Sammy"}))

    fmt.Println(joinWithVariadic("&", "Sammy", "Jessica", "Drew", "Jamie"))
    fmt.Println(joinWithVariadic("->", "Sammy", "Jessica"))
    fmt.Println(joinWithVariadic(";", "Sammy"))
    // using explode suffixing
    fmt.Println(joinWithVariadic("&", []string{"Sammy", "Jessica", "Drew", "Jamie"}...))
    usingMeasureTemperature()
}

var checkVowel = func() {
    fmt.Println("Enter your name: ")
    var name string
    fmt.Scanln(&name)
    isVowel := false
    for _, v := range strings.ToLower(name) {
        if v == 'a' || v == 'e' || v == 'i' || v == 'o' || v == 'u' {
            isVowel = true
        }
    }
    if isVowel {
        fmt.Println("Your name contains a vowel.")
    } else {
        fmt.Println("Your name does not contain a vowel.")
    }
}

func repeatString(word string, repeation int) (string, error) {
    if repeation <= 0 {
        return "", fmt.Errorf(
            "invalid value of %d provided for repeation. value must be greater than zero",
            repeation,
        )
    }
    var value string
    for i := 0; i < repeation; i++ {
        value += word
    }
    return value, nil
}

func addNumbers(x, y, z int) {
    a := x + y
    b := y + z
    c := z + x
    fmt.Println(a, b, c)
}

func doubleInt(x int) int {
    return x * 2
}

func loopFive() {
    for i := 0; i < 25; i++ {
        fmt.Println("loopFive ->", i)
        if i == 5 {
            // Stop function at i == 5
            return
        }
    }
    fmt.Println("This line will not execute.")
}

func sayHello(names ...string) {
    if len(names) == 0 {
        fmt.Println("nobody to greet")
        return
    }
    for _, n := range names {
        fmt.Printf("Hello %s\n", n)
    }
}

func join(delimiter string, values []string) string {
    var line string
    stop := len(values) - 1
    for i, v := range values {
        line += v
        if i < stop {
            line += delimiter
        }
    }
    return line
}

func joinWithVariadic(delimiter string, values ...string) string {
    var line string
    stop := len(values) - 1
    for i, v := range values {
        line += v
        if i < stop {
            line += delimiter
        }
    }
    return line
}

type kelvin float64
type sensor func() kelvin

func measureTemperature(samples int, s sensor) {
    for i := 0; i < samples; i++ {
        k := s()
        fmt.Printf("%v k\n", k)
        time.Sleep(time.Second)
    }
}

func fakeSensor() kelvin {
    return kelvin(rand.Intn(151) + 150)
}

func usingMeasureTemperature() {
    measureTemperature(3, fakeSensor)
}

// equivalent to the following `minMax`
func namedMinMax(x, y int) (min, max int) {
    if x > y {
        min = y
        max = x
    } else {
        min = x
        max = y
    }
    return
}

// equivalent to the above `nameMinMax`
func minMax(x, y int) (min, max int) {
    if x > y {
        min = y
        max = x
    } else {
        min = x
        max = y
    }
    return min, max
}
