package main

import (
	"fmt"
	"net"
)

func main() {
	// The `net.Interfaces()` function returns all of the interfaces
	// of the current machine as a slice with elements of the `net.Interface` type
	interfaces, err := net.Interfaces()
	if err != nil {
		fmt.Println(err)
		return
	}

	for _, i := range interfaces {
		fmt.Printf("Interface: %v\n", i.Name)
		byName, err := net.InterfaceByName(i.Name)
		if err != nil {
			fmt.Println(err)
		}

		addresses, err := byName.Addrs()
		for k, v := range addresses {
			fmt.Printf("Interface Address #%v : %v\n", k, v.String())
		}
		fmt.Println()
	}
}
