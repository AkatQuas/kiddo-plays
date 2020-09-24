package main
/*
In this file, you will learn how to use the `syscall` package
to capture raw ICMP network data and `syscall.SetsockoptInt()`
in order to set the options of a socket.

start this lowLevel server:
	sudo go run syscallNet.go

create ICMP traffic
	ping localhost
*/

import (
	"fmt"
	"os"
	"syscall"
)

func main() {
    // `syscall.AF_INET` tells `syscall.Socket()` that you want to work with IPv4.
	// `syscall.SOCK_RAW` is what makes the generated socket a raw socket.
	// `syscall.IPPROTO_ICMP` tells `syscall.Socket()` that you are interested in ICMP traffic only.
	fd, err := syscall.Socket(syscall.AF_INET, syscall.SOCK_RAW, syscall.IPPROTO_ICMP)
	if err != nil {
		fmt.Println("Error in syscall.Socket:", err)
		return
	}

	f := os.NewFile(uintptr(fd), "captureICMP")
	if f == nil {
		fmt.Println("Error in os.NewFile:", err)
		return
	}

	// `syscall.SetsockoptInt()` sets the size of the receive buffer of the socket to 256.
	// The `syscall.SOL_SOCKET` parameter is for stating that you want to work on the socket layer level.
	err = syscall.SetsockoptInt(fd, syscall.SOL_SOCKET, syscall.SO_RCVBUF, 256)
	if err != nil {
		fmt.Println("Error in syscall.Socket:", err)
		return
	}

	// Due to the for loop, syscallNet.go will keep capturing ICMP network packets
	// until you terminate it manually.
	for {
		buf := make([]byte, 1024)
		numRead, err := f.Read(buf)
		if err != nil {
			fmt.Println(err)
		}
		fmt.Printf("% X\n", buf[:numRead])
	}
}
