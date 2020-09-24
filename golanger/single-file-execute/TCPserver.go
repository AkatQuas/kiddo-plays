package main

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"strings"
	"time"
)

/*
start this server:
	go run TCPserver.go 8001

connect to this server:
	nc 127.0.0.1 8001
*/
func main() {
	arguments := os.Args
	if len(arguments) == 1 {
		fmt.Println("Please provide port number")
		return
	}

	PORT := ":" + arguments[1]
	// The `net.Listen()` function listens for connections.
	//
	// If the second parameter does not contain an IP address, but only a port number,
	// `net.Listen()` will listen on all available IP addresses of the local system.
	l, err := net.Listen("tcp", PORT)
	if err != nil {
		fmt.Println(err)
		return
	}
	defer l.Close()

	// The `Accept()` function waits for the next connection and returns a generic `Conn` variable.
	c, err := l.Accept()
	if err != nil {
		fmt.Println(err)
		return
	}
	// The only thing that is wrong with this particular TCP server is that it can only serve the first TCP client,
	// which is going to connect to it because the `Accept()` call is outside the for loop that is coming next.

	for {
		netData, err := bufio.NewReader(c).ReadString('\n')
		if err != nil {
			fmt.Println(err)
			return
		}
		if strings.TrimSpace(string(netData)) == "STOP" {
			fmt.Println("Exiting TCP server!")
			c.Close()
			return
		}

		fmt.Print("-> ", string(netData))
		t := time.Now()
		myTime := t.Format(time.RFC3339) + "\n"
		c.Write([]byte(myTime))
	}
}
