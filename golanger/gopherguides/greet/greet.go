package greet

import "fmt"

var Shark = "Sammy"

type Octopus struct {
  Name string
  Color string
}

func (o *Octopus) String() string {
  return fmt.Sprintf("The octopus's name is %q and %s is the color.\n", o.Name, o.Color)
}

func (o *Octopus) reset() {
  o.Name = ""
  o.Color = ""
}

func Hello() {
  fmt.Println("Hello, World!")
}
