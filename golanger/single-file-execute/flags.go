package main

import (
    "bufio"
    "errors"
    "flag"
    "fmt"
    "io"
    "os"
    _ "strings"
)

type Color string

const (
    ColorBlack Color = "\u001b[30m"
    ColorRed         = "\u001b[31m"
    ColorGreen       = "\u001b[32m"
    ColorReset       = "\u001b[0m"
)

func main() {
    // flags can only run parse once
    // the following functions should
    // run one by one

    /*
      $ go run flags.go
      $ go run flags.go -color
    */
    // parseColor()

    /*
      $ go run flags.go -n 10 flags.go
      $ echo "fish\nlobsters\nsharks\nminnows" | go run flags.go -n 4
    */
    // readFile()

    if true {
        /*
           $ go run flags.go hello
           $ go run flags.go greet
           $ go run flags.go greet -name sammy
        */
        if err := usingSubCommand(os.Args[1:]); err != nil {
            fmt.Println(err)
        }
    }
}

func parseColor() {
    colorize := func(color Color, message string) {
        fmt.Println(string(color), message, string(ColorReset))
    }

    useColor := flag.Bool("color", false, "display colorized output")
    flag.Parse()

    if *useColor {
        colorize(ColorRed, "Hello, DigitalOcean! in red")
    } else {
        fmt.Println("Hello, Digital Ocean!")
    }
}

func readFile() {
    var count int
    flag.IntVar(&count, "n", 5, "number of lines to read from the file")
    flag.Parse()

    var in io.Reader
    if filename := flag.Arg(0); filename != "" {
        f, err := os.Open(filename)
        if err != nil {
            fmt.Println("error opening file: err:", err)
            return
        }
        defer f.Close()
        in = f
    } else {
        in = os.Stdin
    }

    buf := bufio.NewScanner(in)

    for i := 0; i < count; i++ {
        if !buf.Scan() {
            break
        }
        fmt.Println(buf.Text())
    }

    if err := buf.Err(); err != nil {
        fmt.Fprintln(os.Stderr, "error reading: err:", err)
    }
}

func NewGreetCommand() *GreetCommand {
    gc := &GreetCommand{
        fs: flag.NewFlagSet("greet", flag.ContinueOnError),
    }

    gc.fs.StringVar(&gc.name, "name", "World", "name of the person to be greeted")

    return gc
}

type GreetCommand struct {
    fs *flag.FlagSet

    name string
}

func (g *GreetCommand) Name() string {
    return g.fs.Name()
}

func (g *GreetCommand) Init(args []string) error {
    return g.fs.Parse(args)
}

func (g *GreetCommand) Run() error {
    fmt.Println("Hello", g.name, "!")
    return nil
}

type Runner interface {
    Init([]string) error
    Run() error
    Name() string
}

func usingSubCommand(args []string) error {
    if len(args) < 1 {
        return errors.New("You must pass a sub-command")
    }

    cmds := []Runner{
        NewGreetCommand(),
    }

    subcommand := os.Args[1]

    for _, cmd := range cmds {
        if cmd.Name() == subcommand {
            cmd.Init(os.Args[2:])
            return cmd.Run()
        }
    }
    return fmt.Errorf("Unknown subcommand: %s", subcommand)
}
