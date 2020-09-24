package main

import (
    "bufio"
    "errors"
    "fmt"
    "io"
    "log"
    "log/syslog"
    "os"
    "path/filepath"
)

func main() {
    myString := ""
    arguments := os.Args
    if len(arguments) == 1 {
        myString = "Please give me one argument!"
    } else {
        myString = "You give me:" + arguments[1]
    }
    io.WriteString(os.Stdout, myString)
    io.WriteString(os.Stdout, "\n")
    //ReadFromFile()
    //readFromStdin()
    //writeToLogFile()
    playWithError()
}

func writeToLogFile() {
    pwd := filepath.Dir(os.Args[0])
    programName := filepath.Base(os.Args[0])
    fmt.Println("Working in", pwd, "with file", programName)
    sysLog, err := syslog.New(syslog.LOG_INFO|syslog.LOG_LOCAL7, programName)
    if err != nil {
        log.Fatal(err)
    } else {
        log.SetOutput(sysLog)
    }
    log.Println("LOG_INFO + LOG_LOCAL7: Logging in GO!")

}

// ReadFromFile is a small func
func ReadFromFile() {
    var f *os.File
    f, _ = os.Open("./one-arg.go")
    defer f.Close()

    scanner := bufio.NewScanner(f)
    fmt.Println("Echoing...")
    for scanner.Scan() {
        fmt.Println(">", scanner.Text())
    }
}

func readFromStdin() {
    var f *os.File
    f = os.Stdin
    defer f.Close()

    scanner := bufio.NewScanner(f)
    fmt.Println("Echoing...")
    for scanner.Scan() {
        if scanner.Text() == "quit" {
            fmt.Println("Bye~")
            break
        }

        fmt.Println(">", scanner.Text())
    }
}

func playWithError() {
    err := returnError(1, 2)
    if err == nil {
        fmt.Println("returnError() ended normally!")
    } else {
        fmt.Println(err)
    }
    err = returnError(10, 10)
    if err == nil {
        fmt.Println("returnError() ended normally!")
    } else {
        fmt.Println(err)
    }
    if err.Error() == "Error in returnError() function!" {
        fmt.Println("!!")
    }
}

func returnError(a, b int) error {
    if a == b {
        err := errors.New("Error in returnError() function!")
        return err
    } else {
        return nil
    }
}
