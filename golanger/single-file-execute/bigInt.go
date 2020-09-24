package main

import (
    "fmt"
    "math/big"
)

/*
detailed package documentation: https://golang.org/pkg/math/big/
*/

func main() {
    lightSpeed := big.NewInt(299792)
    secondsPerDay := big.NewInt(86400)
    /*
      secondsPerday := new(big.Int)
      secondsPerday.SetString("86400", 10)
    */

    distance := new(big.Int)
    distance.SetString("24000000000000000000", 10)
    fmt.Println("Andromeda Galaxy is", distance, "km away.")

    seconds := new(big.Int)
    seconds.Div(distance, lightSpeed)

    days := new(big.Int)
    days.Div(seconds, secondsPerDay)
    fmt.Println("That is", days, "days of travel at light speed.")

    /*
      Calculations on constants and literals are performed during compilation rather than while the program is running.
      The Go compiler is written in Go.
      Under the hood, untyped numeric constants are backed by the `big` package,
      enabling all the usual operations with numbers well beyond 18 quintillion
    */
    fmt.Println("Andromeda Galaxy is", 24000000000000000000/299792/86400, "light days away.")

    constantsDivision()
}

func constantsDivision() {
    // this is no type error
    const distance = 24000000000000000000
    const lightSpeed = 299792
    const secondsPerDay = 86400
    const days = distance / lightSpeed / secondsPerDay
    fmt.Println("Andromeda Galaxy is", days, "light days away.")
}
