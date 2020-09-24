package main

import (
	"fmt"
	"net"
	"os"
)

/*
	go run findMXRecords.go bing.com
  host -t mx bing.com

	go run findMXRecords.go golang.com
  host -t mx golang.com
*/

// The MX records specify the mail servers of a domain.
func main() {
	arguments := os.Args
	if len(arguments) == 1 {
		fmt.Println("Need a domain name!")
		return
	}

	domain := arguments[1]
	MXs, err := net.LookupMX(domain)
	if err != nil {
		fmt.Println(err)
		return
	}

	for _, MX := range MXs {
		fmt.Println(MX.Host)
	}
}
