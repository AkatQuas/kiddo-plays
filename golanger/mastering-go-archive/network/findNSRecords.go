package main

import (
	"fmt"
	"net"
	"os"
)

/*
	go run findNSRecords.go bing.com
	host -t ns cn.bing.com

	go run findNSRecords.go baidu.com
	host -t ns www.baidu.com
*/
//  finding out the name servers of a domain,
// which are stored in the NS records of that domain.
func main() {
	arguments := os.Args
	if len(arguments) == 1 {
		fmt.Println("Need a domain name!")
		return
	}

	domain := arguments[1]
	NSs, err := net.LookupNS(domain)
	if err != nil {
		fmt.Println(err)
		return
	}

	for _, NS := range NSs {
		fmt.Println(NS.Host)
	}
}
