package main

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"strings"
)


/*
start a UDP server:
	nc -v -u -l 127.0.0.1 8001

start this UDP client:
	go run UDPcilent.go localhost:8001

once the UDPclient close its connection,
the server need to close that connection manually
*/
func main() {
	arguments := os.Args
	if len(arguments) == 1 {
		fmt.Println("Please provide a host:port string")
		return
	}
	CONNECT := arguments[1]

	// The `net.ResolveUDPAddr()` function returns an address of a UDP end point as defined by its second parameter.
	// The first parameter (udp4) specifies that the program will support the IPv4 protocol only.
	s, err := net.ResolveUDPAddr("udp4", CONNECT)

	// The `net.DialUDP()` function used is like `net.Dial()` for UDP networks.
	c, err := net.DialUDP("udp4", nil, s)

	if err != nil {
		fmt.Println(err)
		return
	}

	fmt.Printf("The UDP server is %s\n", c.RemoteAddr().String())
	defer c.Close()

	for {
		// read text from standard input, using `bufio.NewReader`
		reader := bufio.NewReader(os.Stdin)
		fmt.Print(">> ")

		text, _ := reader.ReadString('\n')
		data := []byte(text + "\n")
		// `Write(data)` method sends the data over the UDP network connection
		_, err = c.Write(data)
		if strings.TrimSpace(string(data)) == "STOP" {
			fmt.Println("Exiting UDP client!")
			c.Close()
			return
		}

		if err != nil {
			fmt.Println(err)
			return
		}

		buffer := make([]byte, 1024)
		n, _, err := c.ReadFromUDP(buffer)
		if err != nil {
			fmt.Println(err)
			return
		}
		fmt.Printf("Reply: %s\n", string(buffer[0:n]))
	}
}
