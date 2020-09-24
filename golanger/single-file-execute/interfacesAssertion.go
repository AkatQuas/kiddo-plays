package main

import (
	"fmt"
	"math"
)

type Shape interface {
	Area() float64
	Perimeter() float64
}


type square struct {
	X float64
}

type circle struct {
	R float64
}

type rectangle struct {
	X float64
	Y float64
}

func (s square) Area() float64 {
	return s.X * s.X
}

func (s square) Perimeter() float64 {
	return 4 * s.X
}

func (s circle) Area() float64 {
	return s.R * s.R * math.Pi
}

func (s circle) Perimeter() float64 {
	return 2 * s.R * math.Pi
}

func Calculate(x Shape) {
	// assert if x is circle
	_, ok := x.(circle)
	if ok {
		fmt.Println("Is a circle!")
	}

	// assert if x is square
	v, ok := x.(square)
	if ok {
		fmt.Println("Is a square:", v)
	}

	fmt.Println(x.Area())
	fmt.Println(x.Perimeter())
}

func tellInterface(x interface{}) {
	// All of the magic is performed by the use of the x.(type) statement,
	// which returns the type of the x element
	switch v := x.(type) {
	case square:
		fmt.Println("This is a square!")
	case circle:
		fmt.Printf("%v is a circle!\n", v)
	case rectangle:
		fmt.Println("This is a rectangle!")
	default:
		fmt.Printf("Unknown type %T!\n", v)
	}
}

func main() {
	x := square{X: 10}
	fmt.Println("Perimeter:", x.Perimeter())
	Calculate(x)
	y := circle{R: 5}
	Calculate(y)
	tellInterface(x)
	z := rectangle{X: 4, Y: 1}
	tellInterface(z)
	t := square{X: 4}
	tellInterface(t)
	tellInterface(10)
}
