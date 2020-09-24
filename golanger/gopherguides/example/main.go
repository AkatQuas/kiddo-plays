package main

import (
  "fmt"

  "github.com/gopherguides/greet"
  "github.com/gopherguides/logging"
)

func main() {
  greet.Hello()

  fmt.Println(greet.Shark)

  oct := greet.Octopus{
    Name: "Jesse",
    Color: "orange",
  }
  fmt.Println(oct.String())

  logger := logging.New(time.RFC3339, true)
  logger.Log("info", "starting up service...")
  logger.Log("warning", "no tasks found...")
  logger.Log("error", "exiting: no work performed...")
}

