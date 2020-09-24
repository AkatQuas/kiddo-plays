package main

import (
    "errors"
    "fmt"
    "io"
    "io/ioutil"
    "log"

    "net/http"
    "os"
    "strings"
    "time"
)

var (
    ErrBounds = errors.New("out of bounds")
    ErrDigit  = errors.New("invalid digit")
)

func main() {
    // Errors
    usingErrors()
    usingMyError()
    usingRequestError()
    usingWrappedError()
    deferFunction()
    fmt.Println("---Now we are going to panic")
    // Panics
    // panic("oh no!")
    // simplePanic()
    // simplePanic2()

    deferBeforePanic()

    // deferAfterPanic()
    divideByZero()
    fmt.Println("we will survived dividing by zero!")

    if files, err := ioutil.ReadDir("."); err != nil {
        fmt.Println("Readdir with error", err)
    } else {
        for _, file := range files {
            fmt.Printf("filename: %v\n", file.Name())
        }
    }
    proverbs("errors-are-values.txt")
    fmt.Println("SudokuError is:", setSudokuError())
}

func capitalize(name string) (string, error) {
    if name == "" {
        return "", errors.New("No name provided")
    }
    return strings.ToTitle(name), nil
}

func capitalize2(name string) (string, int, error) {
    handle := func(err error) (string, int, error) {
        return "", 0, err
    }

    if name == "" {
        return handle(errors.New("no name provided"))
    }

    return strings.ToTitle(name), len(name), nil
}

func usingErrors() {
    err := errors.New("barnacles")
    fmt.Println("Sammy says:", err)
    fmt.Printf("%T \n", err)

    err2 := fmt.Errorf("Error2 occurred at: %v", time.Now())
    fmt.Println("An error happended:", err2)
    fmt.Printf("%T \n", err2)

    boom := func(msg string) error {
        return errors.New("Boom: " + msg)
    }

    if err3 := boom("bad"); err3 != nil {
        fmt.Println("An error3 occurred:", err3)
    } else {
        fmt.Println("Error3 not occurred, everything is ok")
    }

    if name, err := capitalize("sammy"); err != nil {
        fmt.Println("Could not capitalize:", err)
    } else {
        fmt.Println("Capitalized name:", name)
    }

    if name, err := capitalize(""); err != nil {
        fmt.Println("Could not capitalize:", err)
    } else {
        fmt.Println("Capitalized name:", name)
    }

    if name, size, err := capitalize2("shark"); err != nil {
        fmt.Println("An error occurred:", err)
    } else {
        fmt.Printf("Capitalized name: %s, length: %d\n", name, size)
    }

    if name, size, err := capitalize2(""); err != nil {
        fmt.Println("An error occurred:", err)
    } else {
        fmt.Printf("Capitalized name: %s, length: %d\n", name, size)
    }

    if _, _, err := capitalize2("octupus"); err != nil {
        fmt.Println("An error occurred:", err)
    } else {
        fmt.Println("Success")
    }

}

type MyError struct {
    msg string
}

func (m *MyError) Error() string {
    return "boom" + m.msg
}

func sayHello() (string, error) {
    return "", &MyError{
        msg: "->too bad",
    }
}

func usingMyError() {
    if s, err := sayHello(); err != nil {
        fmt.Println("unexpected error: err:", err)
    } else {
        fmt.Println("The string:", s)
    }
}

type RequestError struct {
    StatusCode int
    Err        error
}

func (r *RequestError) Error() string {
    return fmt.Sprintf("status %d: err %v", r.StatusCode, r.Err)
}

func (r *RequestError) Temporary() bool {
    return r.StatusCode == http.StatusServiceUnavailable // 503
}

func doRequest() error {
    return &RequestError{
        StatusCode: 503,
        Err:        errors.New("unavailable"),
    }
}

func usingRequestError() {
    err := doRequest()
    if err != nil {
        fmt.Println(err)

        // we attempt to expose all methods from RequestError by using
        // the type assertion `re, ok := err.(*RequestError)`.
        // If the type assertion succeeded,
        // we then use the `Temporary()` method to see
        // if this error is a temporary error.

        re, ok := err.(*RequestError)

        if ok {
            if re.Temporary() {
                fmt.Println("This request can be retried again")
            } else {
                fmt.Println("This request can not be retried again")
            }
        } else {
            fmt.Println("Do request succeed")
        }
    }
}

type WrappedError struct {
    Context string
    Err     error
}

func (w *WrappedError) Error() string {
    return fmt.Sprintf("%s: %v", w.Context, w.Err)
}

func Wrap(err error, info string) *WrappedError {
    return &WrappedError{
        Context: info,
        Err:     err,
    }
}

func usingWrappedError() {
    err := errors.New("Boom!New")
    // type conflict??
    fmt.Printf("before -> %T \n", err)
    err = Wrap(err, "usingWrappedError")
    fmt.Printf("after -> %T \n", err)
    fmt.Println(err)
}

func simplePanic() {
    names := []string{
        "lobster",
        "sea urchin",
        "sea cucumber",
    }
    fmt.Println("My favroite sea creature is :", names[len(names)])
}

type Shark struct {
    Name string
}

func (s *Shark) SayHello() {
    fmt.Println("Hi| My Name is", s.Name)
}

func simplePanic2() {
    s := &Shark{"Sammy"}
    s = nil
    s.SayHello()
}

func deferBeforePanic() {
    defer func() {
        fmt.Println("Defer called before the panic")
        if e := recover(); e != nil {
            fmt.Println("after recover:", e)
        }
    }()
    panic("oh no")
}

func deferAfterPanic() {
    panic("oh no")
    defer func() {
        fmt.Println("Defer called after the panic")
    }()
}

func deferFunction() {
    defer func() {
        fmt.Println("Defer called here")
    }()
    fmt.Println("We call after defer")
}

func divideByZero() {
    defer func() {
        // The err value returned from `recover()`
        // is exactly the value that was provided to the call to `panic()`.
        // It’s therefore critical to ensure that the `err` value
        // is only `nil` when a `panic` has not occurred.

        if err := recover(); err != nil {
            log.Println("Panic occurred:", err)
        }
        fmt.Println("after recover")
    }()
    fmt.Println(divide(1, 0))
    fmt.Println(divide(1, 1))
}
func divide(a, b int) int {
    if b == 0 {
        // "oh on" will be passed to `recover()`
        // panic("oh on")
        panic(nil)
    }
    return a / b
}

type safeWriter struct {
    w   io.Writer
    err error
}

func (sw *safeWriter) writeln(s string) {
    if sw.err != nil {
        return
    }

    _, sw.err = fmt.Fprintln(sw.w, s)
}

func proverbs(name string) error {
    f, err := os.Create(name)
    if err != nil {
        return err
    }

    defer f.Close()
    sw := safeWriter{w: f}
    sw.writeln("Errors are values.")
    sw.writeln("Don’t just check errors, handle them gracefully.")
    sw.writeln("Don't panic.")
    sw.writeln("Make the zero value useful.")
    sw.writeln("The bigger the interface, the weaker the abstraction.")
    sw.writeln("interface{} says nothing.")
    sw.writeln("Gofmt's style is no one's favorite, yet gofmt is everyone's favorite.")
    sw.writeln("Documentation is for users.")
    sw.writeln("A little copying is better than a little dependency.")
    sw.writeln("Clear is better than clever.")
    sw.writeln("Concurrency is not parallelism.")
    sw.writeln("Don’t communicate by sharing memory, share memory by communicating.")
    sw.writeln("Channels orchestrate; mutexes serialize.")
    return sw.err
}

type SudokuError []error

func (se SudokuError) Error() string {
    var s []string
    for _, err := range se {
        s = append(s, err.Error())
    }
    return strings.Join(s, ", ")
}

func setSudokuError() error {
    var errs SudokuError

    errs = append(errs, ErrBounds)
    errs = append(errs, ErrDigit)

    return errs
}
