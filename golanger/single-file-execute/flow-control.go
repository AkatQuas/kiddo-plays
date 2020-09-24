package main

import (
    "bytes"
    "fmt"
    "io"
    "log"
    "math/rand"
    "os"
)

func main() {
    simpleIf()
    simpleSwitch()
    compareSwitch()
    fallthroughSwitch()
    simpleForLoop()
    nestedForLoop()
    fmt.Println(simpleDefer())
    writeFileWithoutDefer()
    writeFileWithDefer()
    fmt.Println(deferTiming())
    fmt.Println(deferTiming2())
    fmt.Println("deferTiming3 in main:", deferTiming3())
    bigDefer()
}

func judgeGrade(grade int) {
    if grade > 60 {
        fmt.Println("Passing grade")
    } else if grade == 60 {
        fmt.Println("Barely pass grade")
    } else {
        fmt.Println("Failing grade")
    }
}

func simpleIf() {
    judgeGrade(70)
    judgeGrade(60)
    judgeGrade(50)

    balance := -5
    if balance < 0 {
        fmt.Println("Balance is below 0, add funds now or you will be charged a penalty.")
    }
}

func simpleSwitch() {
    flavors := []string{"chocolate", "vanilla", "strawberry", "banana"}
    for _, flav := range flavors {
        switch flav {
        case "strawberry":
            fmt.Println(flav, "is my favorite!")
        case "vanilla", "chocolate":
            fmt.Println(flav, "is great!")
        default:
            fmt.Println("I've never tried", flav, "before")
        }
    }
}

func compareSwitch() {
    target := rand.Intn(100)

    for {
        var guess int
        fmt.Print("Enter a guess:")
        _, err := fmt.Scanf("%d", &guess)
        if err != nil {
            fmt.Println("Invalid guess: err:", err)
            continue
        }

        switch {
        case guess > target:
            fmt.Println("Too high!")
        case guess < target:
            fmt.Println("Too low!")
        default:
            fmt.Println("You win!")
            return
        }
    }
}

func fallthroughSwitch() {
    flavors := []string{"chocolate", "vanilla", "strawberry", "banana"}
    for _, flav := range flavors {
        switch flav {
        case "strawberry":
            fmt.Println(flav, "is my favorite!")
            fallthrough
        case "vanilla", "chocolate":
            fmt.Println(flav, "is great!")
        default:
            fmt.Println("I've never tried", flav, "before")
        }
    }
}

func simpleForLoop() {
    /*
      for [ Initial Statement ] ; [ Condition ] ; [ Post Statement ] {
        [ Action ]
        [ Action ]
      }
    */

    for i := 100; i > 0; i -= 10 {
        fmt.Println("step down", i)
    }

    for i := 0; i < 10; {
        if i > 7 {
            fmt.Println("step too big to break at", i)
            break
        }
        fmt.Println("step up", i)
        i += 2
    }

    buf := bytes.NewBufferString("one\ntwo\nthree\nfour\n")
    for {
        line, err := buf.ReadString('\n')
        if err != nil {
            if err == io.EOF {
                fmt.Println("EOF:", line)
                break
            }
            fmt.Println("Error:", err)
            break
        }
        fmt.Println("NormalLine:", line)
    }

    sharks := []string{"hammerhead", "great white", "dogfish", "frilled", "bullhead", "requiem"}

    for i := 0; i < len(sharks); i++ {
        fmt.Println("shark is", sharks[i])
    }

    for i, shark := range sharks {
        fmt.Println("shark", i, "has name", shark)
    }

    for _, shark := range sharks {
        fmt.Println("skip also has name", shark)
    }

    integers := make([]int, 10)
    fmt.Println("before", integers)

    for i := range integers {
        integers[i] = i
    }
    fmt.Println("after", integers)

    sammy := "Sammy Shark"
    for i, letter := range sammy {
        fmt.Printf("character at %d is %c\n", i, letter)
    }

    sammyShark := map[string]string{
        "name":     "Sammy",
        "animal":   "shark",
        "color":    "blue",
        "location": "ocean",
    }

    for key, value := range sammyShark {
        fmt.Printf("key %q, value %q\n", key, value)
    }
}

func nestedForLoop() {
    /*
      // nested for loops
      for {
        [Action]
        for {
          [Action]
        }
      }
    */

    numList := []int{1, 2, 3}
    alphaList := []string{"a", "b", "c"}

    for _, i := range numList {
        fmt.Printf("At line-> %d:", i)
        for _, letter := range alphaList {
            fmt.Print(letter)
        }
        fmt.Print("\n")
    }

    ints := [][]int{
        []int{0, 1, 2},
        []int{-1, -2, -3},
        []int{9, 8, 7},
    }

    for _, i := range ints {
        fmt.Println(i)
        for _, j := range i {
            fmt.Println(j)
        }
    }

    for i := 0; i < 10; i++ {
        if i == 5 {
            fmt.Println("Continuing loop")
            continue // break here
        }
        fmt.Println("The value of i is", i)
    }
    fmt.Println("Exiting function")
}

func simpleDefer() string {
    time := "twice"
    // defer statement is executed, it places
    // `fmt.Println()` functions on a stack to be executed
    // prior (before) to the function returning.
    // note that the arguments are evaluated immediately.
    // defer calls are placed on stack
    // they are called in last-in-first-out order
    defer fmt.Println("Bye", time) // first in, last called

    time = "first"
    defer fmt.Println("Bye", time) // last in, first called

    fmt.Println("hi")
    // two defer functions are called here, in their correct order
    return "World"
}

func writeFileWithoutDefer() {
    write := func(fileName string, text string) error {
        file, err := os.Create(fileName)
        if err != nil {
            return err
        }
        _, err = io.WriteString(file, text)
        if err != nil {
            file.Close()
            return err
        }
        file.Close()
        return nil
    }

    if err := write("readme.txt", "This is a readme file"); err != nil {
        log.Fatal("Failed to write file:", err)
    }
}

func writeFileWithDefer() {
    write := func(fileName string, text string) error {
        file, err := os.Create(fileName)
        if err != nil {
            return err
        }
        defer file.Close()
        _, err = io.WriteString(file, text)
        if err != nil {
            return err
        }
        return file.Close()
    }

    if err := write("readnme.txt", "This is an readme file"); err != nil {
        log.Fatal("Failed to write file:", err)
    }
}

func deferTiming() string {
    result := "Hello world"
    defer func() {
        result = "Change World" // won't change value
        fmt.Println(result)
    }()
    return result
}

func deferTiming2() (result int) {
    defer func() {
        result = 7 // change value at the very last moment
        // this also means
        // `defer` is executed AFTER `return` or `panic`
        // more details look at `deferTiming3()`
        fmt.Println(result)
    }()
    return 0
}

func deferTiming3() (x int) {
    defer func(n int) {
        fmt.Printf("in defer x as parameter: x = %d\n", n)
        fmt.Printf("in defer x after return: x = %d\n", x)
        x = 10
    }(x)

    x = 7
    return 9
}

func bigDefer() {
    write := func(fileName string, text string) error {
        file, err := os.Create(fileName)
        if err != nil {
            return err
        }

        defer file.Close()

        _, err = io.WriteString(file, text)
        if err != nil {
            return err
        }
        return file.Close()
    }

    fileCopy := func(source string, destination string) error {
        src, err := os.Open(source)
        if err != nil {
            return err
        }
        defer src.Close()

        dst, err := os.Create(destination)
        if err != nil {
            return err
        }
        defer dst.Close()

        n, err := io.Copy(dst, src)
        if err != nil {
            return err
        }

        fmt.Printf("Copied %d bytes from %s to %s\n", n, source, destination)
        if err := src.Close(); err != nil {
            return err
        }
        return dst.Close()
    }

    if err := write("sample.txt", "This file contains some sample text"); err != nil {
        log.Fatal("Failed to create file:", err)
    }
    if err := fileCopy("sample.txt", "sample-copy.txt"); err != nil {
        log.Fatal("Failed to copy file:", err)
    }
}
