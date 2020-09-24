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
    go run TCPclient.go localhost:8001

Now you are good to communicate through the TCP connection
*/
func main() {
    arguments := os.Args
    if len(arguments) == 1 {
        fmt.Println("Please provide host:port.")
        return
    }

    CONNECT := arguments[1]
    // The `net.Dial()` function is used for connecting to the remote server.
    c, err := net.Dial("tcp", CONNECT)
    if err != nil {
        fmt.Println(err)
        return
    }
    defer c.Close()

    for {
        // getting input from the user
        reader := bufio.NewReader(os.Stdin)
        fmt.Print(">> ")

        text, _ := reader.ReadString('\n')
        fmt.Fprintf(c, text+"\n")
        if strings.TrimSpace(string(text)) == "STOP" {
            fmt.Println("TCP client exiting...")
            c.Close()
            return
        }

        message, _ := bufio.NewReader(c).ReadString('\n')
        fmt.Print("->: " + message)
    }
}
