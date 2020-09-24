package main

import "fmt"

const favColor string = "blue"

func PrintSharks() {
    // Define sharks variable as slice of strings
    sharks := []string{
        "hammerhead",
        "great white",
        "dogfish",
        "frilled",
        "bullehead",
        "requiem",
    }

    // For loop that iterates over sharks list and
    // prints each string item
    for _, shark := range sharks {
        fmt.Println(shark)
    }
}

/*
func MustGet(url string) string {
  resp, err := http.Get(url)
  if err != nil {
    panic(err)
  }

  defer resp.Body.Close()
  var body []byte
  if body, err = ioutil.ReadAll(resp.Body); err != nil {
    panic(err)
  }
  return string(body)
}
*/

func main() {
    PrintSharks()
    var guess string
    // Create an input loop
    for {
        // Ask the user to guess my favorite color
        fmt.Println("Guess my favorite color:")
        // Try to read a line of input from the user.
        // Print out the error 0
        if _, err := fmt.Scanln(&guess); err != nil {
            fmt.Printf("%s\n", err)
            return
        }
        // Did they guess the correct color?
        if favColor == guess {
            // They guessed it!
            fmt.Printf("%q is my favorite color!\n", favColor)
            return
        }
        // Wrong! Have them guess again.
        fmt.Printf("Sorry, %q is not my favorite color. Guess again.\n", guess)
    }
}
