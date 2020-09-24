package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func handle(signal os.Signal) {
	fmt.Println("Received:", signal)
}

/*
$ ps ax | grep ./signalsHandleAll | grep -v grep
<pid> s003 S+ 0:00.00 ./signalsHandleAll
$ kill -s HUP <pid>
$ kill -s USR2 <pid>
$ kill -s USR1 <pid>
$ kill -s INT <pid>
$ kill -s TERM <pid>
*/
func main() {
	signals := make(chan os.Signal, 1)
	signal.Notify(signals)
	go func() {
		for {
			sig := <-signals
			switch sig {
			case os.Interrupt:
				handle(sig)
			case syscall.SIGTERM:
				handle(sig)
				os.Exit(0)
			case syscall.SIGUSR2:
				fmt.Println("Handling syscall.SIGUSR2!")
			default:
				fmt.Println("Ignoring:", sig)
			}
		}
	}()

	for {
		fmt.Printf(".")
		time.Sleep(30 * time.Second)
	}
}
