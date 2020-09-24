package main

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptrace"
	"os"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Printf("Usage: URL\n")
		return
	}

	URL := os.Args[1]
	// The `http.Client` object offers a way to send a request to a server
	// and get a reply. Its Transport field permits you to
	// set various HTTP details instead of using the default values.
	client := http.Client{}

	req, _ := http.NewRequest("GET", URL, nil)
	// The `httptrace.ClientTrace` object defines the events that interest us.
	// When such an event occurs, the relevant code is executed.
	trace := &httptrace.ClientTrace{
		GotFirstResponseByte: func() {
			fmt.Println("First response byte!")
		},
		GotConn: func(connInfo httptrace.GotConnInfo) {
			fmt.Printf("Got Conn: %+v\n", connInfo)
		},
		DNSDone: func(dnsInfo httptrace.DNSDoneInfo) {
			fmt.Printf("DNS Info: %+v\n", dnsInfo)
		},
		ConnectStart: func(network, addr string) {
			fmt.Println("Dial start")
		},
		ConnectDone: func(network, addr string, err error) {
			fmt.Println("Dial done")
		},
		WroteHeaders: func() {
			fmt.Println("Wrote headers")
		},
	}

	// The `httptrace.WithClientTrace()` function returns a new context,
	// based on the given parent context;
	// while the `http.DefaultTransport.RoundTrip()` method wraps
	// `http.DefaultTransport.RoundTrip` in order to tell it to
	// keep track of the current request.
	req = req.WithContext(httptrace.WithClientTrace(req.Context(), trace))
	fmt.Println("Requesting data from server!")
	_, err := http.DefaultTransport.RoundTrip(req)
	if err != nil {
		fmt.Println(err)
		return
	}

	response, err := client.Do(req)
	if err != nil {
		fmt.Println(err)
		return
	}

	io.Copy(os.Stdout, response.Body)
}
