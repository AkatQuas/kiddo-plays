package dependency_injection

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"time"
)

func GreetToBuffer(writer *bytes.Buffer, name string) {
	fmt.Fprintf(writer, "Hello, %s", name)
}

func Greet(writer io.Writer, name string) {
	fmt.Fprintf(writer, "Hello, %s", name)
}

func GreetToConsole() {
	Greet(os.Stdout, "42")
}

const (
	finalWord      = "Go!"
	countdownStart = 3
)

func Countdown(out io.Writer, sleeper Sleeper) {
	for i := countdownStart; i > 0; i-- {
		fmt.Fprintln(out, i)
		sleeper.Sleep()
	}

	fmt.Fprint(out, finalWord)
}

type Sleeper interface {
	Sleep()
}

type DefaultSleeper struct{}

func (d *DefaultSleeper) Sleep() {
	time.Sleep(1 * time.Second)
}

type ConfigurableSleeper struct {
	duration time.Duration
	sleep    func(time.Duration)
}

func (c *ConfigurableSleeper) Sleep() {
	c.sleep(c.duration)
}

// func main() {
// 	sleeper := &DefaultSleeper{}
// 	Countdown(os.Stdout, sleeper)
// }
