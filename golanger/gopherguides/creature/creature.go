package creature

import (
  "math/rand"
  "time"
  _ "strings" // a blank identifier for unused package
)

var creatures = []string{
  "shark",
  "jellyfish",
  "squid",
  "octopus",
  "dolphin",
}

func init() {
  rand.Seed(time.Now().UnixNano())
  fmt.Println("First init")
}

func init() {
  fmt.Println("Second init")
}

func init() {
  fmt.Println("Third init")
}

func Random() string {
  i := rand.Intn(len(creatures))
  return creatures[i]
}
