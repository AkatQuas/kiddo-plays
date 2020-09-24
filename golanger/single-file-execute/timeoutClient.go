package main

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

var timeout time.Duration

func Timeout(c context.Context,network, host string) (net.Conn, error) {
	conn, err := net.DialTimeout(network, host, timeout)
	if err != nil {
		return nil, err
	}
	// call `SetDeadline()` before any read or write operations
	conn.SetDeadline(time.Now().Add(timeout))
	return conn, nil
}

/*
	go run timeoutClient.go https://cn.bing.com 1
	go run timeoutClient.go https://youtube.com 2
*/

func main() {
	if len(os.Args) == 1 {
		fmt.Printf("Usage: %s URL TIMEOUT\n", filepath.Base(os.Args[0]))
		return
	}

	if len(os.Args) == 3 {
		temp, err := strconv.Atoi(os.Args[2])
		if err != nil {
			fmt.Println("Using Default Timeout!")
		} else {
			timeout = time.Duration(time.Duration(temp) * time.Second)
		}
	}

	URL := os.Args[1]
	c := context.Background()
	c, _ = context.WithTimeout(c, timeout)
	t := http.Transport{
		DialContext: Timeout,
	}

	client := http.Client{
		Transport: &t,
	}

	data, err := client.Get(URL)
	if err != nil {
		fmt.Println(err)
		return
	} else {
		defer data.Body.Close()
		_, err := io.Copy(os.Stdout, data.Body)
		if err != nil {
			fmt.Println(err)
			return
		}
	}
}
