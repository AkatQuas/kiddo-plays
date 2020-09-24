package main

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"strings"
)

/*
start a small server:
    nc -l 127.0.0.1 8001

start this TCP client
    go run TCPclient_other.go localhost:8001

Now you are good to communicate through the TCP connection
*/
func main() {
	arguments := os.Args
	if len(arguments) == 1 {
		fmt.Println("Please provide a server:port string!")
		return
	}

	CONNECT := arguments[1]

	// The `net.ResolveTCPAddr()` function returns the address of a TCP end point (type TCPAddr)
	// and can only be used for TCP networks.
	tcpAddr, err := net.ResolveTCPAddr("tcp4", CONNECT)
	if err != nil {
		fmt.Println("ResolveTCPAddr:", err.Error())
		return
	}

	conn, err := net.DialTCP("tcp4", nil, tcpAddr)
	if err != nil {
		fmt.Println("DialTCP:", err.Error())
		return
	}
	defer conn.Close()

	for {
		reader := bufio.NewReader(os.Stdin)
		fmt.Print(">> ")
		text, _ := reader.ReadString('\n')
		fmt.Fprintf(conn, text+"\n")

		if strings.TrimSpace(string(text)) == "STOP" {
			fmt.Println("TCP client exiting...")
			conn.Close()
			return
		}

		message, _ := bufio.NewReader(conn).ReadString('\n')
		fmt.Print("->: " + message)
	}
}
