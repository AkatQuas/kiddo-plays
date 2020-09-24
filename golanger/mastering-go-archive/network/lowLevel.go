package main

import (
	"fmt"
	"net"
)
/*
Note that working with raw network data
requires root privileges for security reasons.

start this lowLevel server:
	sudo go run lowLevel.go

create ICMP traffic
	ping localhost
*/
func main() {
	netaddr, err := net.ResolveIPAddr("ip4", "127.0.0.1")
	if err != nil {
		fmt.Println(err)
		return
	}
	// Capture ICMP packets, which is built on IPv4 protocol
	// The ICMP protocol is used by the `ping` and `traceroute` utilities,
	// so one way to create ICMP traffic is to use one of these two tools.
	conn, err := net.ListenIP("ip4:icmp", netaddr)
	if err != nil {
		fmt.Println(err)
		return
	}

	// read just a single network packet because there is no `for` loop.
	buffer := make([]byte, 1024)
	n, _, err := conn.ReadFrom(buffer)
	if err != nil {
		fmt.Println(err)
		return
	}

	fmt.Printf("% X\n", buffer[0:n])
}
