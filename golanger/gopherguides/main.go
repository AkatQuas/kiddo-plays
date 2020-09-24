package main

import (
  "fmt"
  "time"
)

var weekday string

func init () {
  weekday = time.Now().Weekday().String()
}

func main() {
  fmt.Printf("Today is %s", weekday)
}
