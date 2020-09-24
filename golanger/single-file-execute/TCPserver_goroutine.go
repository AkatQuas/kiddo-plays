package main

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"
	"time"
)

func f(n int) int {
	fn := make(map[int]int)
	for i := 0; i <= n; i++ {
		var f int
		if i <= 2 {
			f = 1
		} else {
			f = fn[i-1] + fn[i-2]
		}
		fn[i] = f
	}
	return fn[n]
}

// The handleConnection() function deals with each client of the concurrent TCP server.
func handleConnection(c net.Conn) {
	for {
		netData, err := bufio.NewReader(c).ReadString('\n')
		if err != nil {
			fmt.Println(err)
			os.Exit(100)
		}

		temp := strings.TrimSpace(netData)
		if temp == "STOP" {
			break
		}

		fibo := "-1\n"
		n, err := strconv.Atoi(temp)
		if err == nil {
			fibo = strconv.Itoa(f(n)) + "\n"
		}
		c.Write([]byte(fibo))
	}
	time.Sleep(5 * time.Second)
	c.Close()
}
/*
start this server:
	go run TCP_goroutine.go 8001

connect to this server:
	nc 127.0.0.1 8001
*/

func main() {
	arguments := os.Args
	if len(arguments) == 1 {
		fmt.Println("Please provide a port number!")
		return
	}

	PORT := ":" + arguments[1]
	l, err := net.Listen("tcp4", PORT)
	if err != nil {
		fmt.Println(err)
		return
	}
	defer l.Close()

	for {
		c, err := l.Accept()
		if err != nil {
			fmt.Println(err)
			return
		}
		// when a TCP connection comes
		// we pass it the the goroutine function
		go handleConnection(c)
	}
}
