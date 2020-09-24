package main

import (
    "fmt"
    "log"
    "math"
    "strconv"
)

func main() {
    /*
       In this example, we're commenting out the addTwoNumbers
       function because it is failing, therefore preventing it from executing.
       Only the multiplyTwoNumbers function will run

       a := add(3, 5)
       fmt.Println(a)

    */
    m := multiply(5, 9)
    fmt.Println(m)

    voidStar()
    convert1()

    voidStar()
    convert2()

    voidStar()
    convert3()

    voidStar()
    convert4()

    voidStar()
    convert5()

    voidStar()
    convert6()

    voidStar()
    convert7()

    voidStar()
    convert8()

    voidStar()
    convert9()

    voidStar()
    moduloDivision()
}

func add(x, y int) int {
    sum := x + y
    return sum
}

func multiply(x, y int) int {
    product := x * y
    return product
}

func voidStar() {
    fmt.Println("******")
}

func convert1() {
    var index int8 = 15
    var bigIndex int32
    bigIndex = int32(index)
    fmt.Printf("index data type: %T, value: %v\n", index, index)
    fmt.Printf("bigIndex data type: %T, value: %v\n", bigIndex, bigIndex)
}

func convert2() {
    var big int64 = 129
    var little int8
    little = int8(big)
    fmt.Printf("big data type: %T, value: %v\n", big, big)
    fmt.Printf("little data type: %T, value: %v\n", little, little)
}

func convert3() {
    var x int64 = 129
    y := float64(x)
    fmt.Printf("x data type: %T, value: %v\n", x, x)
    fmt.Printf("y data type: %T, value: %.2f\n", y, y)
}

func convert4() {
    var x float64 = 129.42
    y := int(x)
    fmt.Printf("x data type: %T, value: %v\n", x, x)
    fmt.Printf("y data type: %T, value: %v\n", y, y)
}

func convert5() {
    a := 5 / 2
    b := 5.0 / 2
    fmt.Printf(" 5 / 2 is : %v with type: %T \n", a, a)
    fmt.Printf(" 5.0 / 2 is : %v with type: %T \n", b, b)
}

func convert6() {
    a := strconv.Itoa(12)
    fmt.Printf(" strconv.Itoa(12) is : %q with type: %T \n", a, a)
}

func convert7() {
    user := "sammy"
    lines := 50
    fmt.Println("congratulations, " + user + "! You just wrote " + strconv.Itoa(lines) + " lines of code.")
}

func convert8() {
    lines_yesterday := "50"
    lines_today := "108"

    yesterday, err := strconv.Atoi(lines_yesterday)
    if err != nil {
        log.Fatal(err)
    }

    today, err := strconv.Atoi(lines_today)
    if err != nil {
        log.Fatal(err)
    }

    lines_more := today - yesterday
    fmt.Println(lines_more)

    notanumber := "not a number"
    b, err := strconv.Atoi(notanumber)
    fmt.Println(b)
    fmt.Println(err)
}

func convert9() {
    a := "my string"
    b := []byte(a)
    c := string(b)
    fmt.Println(a)
    fmt.Println(b)
    fmt.Println(c)
}

func moduloDivision() {
    q := 36.0
    r := 8.0
    s := math.Mod(q, r)
    fmt.Println(s)
}
