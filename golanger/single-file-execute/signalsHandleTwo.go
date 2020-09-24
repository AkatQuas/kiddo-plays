package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func handleSignal(signal os.Signal) {
	fmt.Println("handleSignal() Caught:", signal)
}

/*
$ ps ax | grep ./signalsHandleTwo | grep -v grep
<pid> s003 S+ 0:00.00 ./signalsHandleTwo
$ kill -s INT <pid>
$ kill -s INFO <pid>
$ kill -s USR1 <pid>
$ kill -9 <pid>
*/
func main() {
	signals := make(chan os.Signal, 1)
	// signal.Notify() state the interested signals.
	signal.Notify(signals, os.Interrupt, syscall.SIGINFO)
	go func() {
		for {
			sig := <-signals
			switch sig {
			case os.Interrupt:
				fmt.Println("Caught:", sig)
			case syscall.SIGINFO:
				handleSignal(sig)
				return
			}
		}
	}()

	for {
		fmt.Printf(".")
		time.Sleep(20 * time.Second)
	}
}
