package main

import (
	"fmt"
	"net"
	"os"
	"strings"
)
/*
start this server:
	go run TCPserver_other.go 8001

connect to this server:
	nc 127.0.0.1 8001
*/
func main() {
	arguments := os.Args
	if len(arguments) == 1 {
		fmt.Println("Please provide a port number!")
		return
	}

	SERVER := "localhost" + ":" + arguments[1]

	s, err := net.ResolveTCPAddr("tcp", SERVER)
	if err != nil {
		fmt.Println(err)
		return
	}

	// The `net.ListenTCP()` function is equivalent to `net.Listen()` for TCP networks.
	l, err := net.ListenTCP("tcp", s)
	if err != nil {
		fmt.Println(err)
		return
	}
	defer l.Close()

	buffer := make([]byte, 1024)
	conn, err := l.Accept()
	if err != nil {
		fmt.Println(err)
		return
	}

	for {
		n, err := conn.Read(buffer)
		if err != nil {
			fmt.Println(err)
			return
		}

		if strings.TrimSpace(string(buffer[0:n])) == "STOP" {
			fmt.Println("Exiting TCP server!")
			conn.Close()
			return
		}

		fmt.Println("> ", string(buffer[0:n-1]))
		_, err = conn.Write(buffer)
		if err != nil {
			fmt.Println(err)
			return
		}
	}
}
