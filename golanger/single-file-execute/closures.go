package main

import (
    "fmt"
)

func main() {
    numGenerator := generator()
    for i := 0; i < 5; i++ {
        fmt.Print(numGenerator(), "\t")
    }
    fmt.Println()
    numGenerator2 := generator()
    for i := 0; i < 5; i++ {
        fmt.Print(numGenerator2(), "\t")
    }
    fmt.Println()
    usingF()
    usingCalibrate()
}

func generator() func() int {
    i := 0
    return func() int {
        i++
        return i
    }
}

func usingF() {
    f := func(message string) {
        fmt.Println(message)
    }
    f("Go to the party")

    func() {
        fmt.Println("IIFE Functions")
        // panic("stna")
    }()
}

type kelvin float64

type sensor func() kelvin

func realSensor() kelvin {
    return 0
}

func calibrate(s sensor, offset kelvin) sensor {
    return func() kelvin {
        return s() + offset
    }
}

func usingCalibrate() {
    sensor := calibrate(realSensor, 5)
    fmt.Println(sensor())

    var k kelvin = 294.0
    sense := func() kelvin {
        return k
    }
    fmt.Println("sensed:", sense())
    k++
    fmt.Println("sensed:", sense())

    planets := [...]string{
        "Mercury",
        "Venus",
        "Earth",
        "Mars",
        "Jupiter",
        "Saturn",
    }
    fmt.Println(planets[2], planets[5])
}
