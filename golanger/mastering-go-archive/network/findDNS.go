package main

import (
    "fmt"
    "net"
    "os"
)

func lookIP(address string) ([]string, error) {
    hosts, err := net.LookupAddr(address)
    if err != nil {
        return nil, err
    }
    return hosts, nil
}

func lookHostname(hostname string) ([]string, error) {
    IPs, err := net.LookupHost(hostname)
    if err != nil {
        return nil, err
    }
    return IPs, nil
}

/*
    go run findDNS.go 127.0.0.1
    go run findDNS.go cn.bing.com
*/
func main() {
    arguments := os.Args
    if len(arguments) == 1 {
        fmt.Println("Please provide an argument!")
        return
    }

    input := arguments[1]
    IPAddress := net.ParseIP(input)

    if IPAddress == nil {
        IPs, err := lookHostname(input)
        if err == nil {
            for _, singleIP := range IPs {
                fmt.Println("hostname", input, "with IP:", singleIP)
            }
        } else {
            fmt.Println("Unable to find IP for hostname", input, err)
        }
    } else {
        hosts, err := lookIP(input)
        if err == nil {
            for _, hostname := range hosts {
                fmt.Println("IP", input, "for hostname", hostname)
            }
        } else {
            fmt.Println("Search host with error:", err)
        }
    }
}
