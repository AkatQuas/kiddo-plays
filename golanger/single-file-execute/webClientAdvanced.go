package main

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Printf("Usage: %s URL\n", filepath.Base(os.Args[0]))
		return
	}

	URL, err := url.Parse(os.Args[1])
	if err != nil {
		fmt.Println("Error in parsing:", err)
		return
	}

	c := &http.Client{
		Timeout: 15 * time.Second,
	}
	// The `http.NewRequest()` function returns an `http.Request` object given a method, a URL, and an optional body.
	// The `http.Do()` function sends an HTTP request (`http.Request`)
	// using an `http.Client` and gets an HTTP response (`http.Response`).
	// So, `http.Do()` does the job of `http.Get()` in a more comprehensive way.

	request, err := http.NewRequest("GET", URL.String(), nil)
	if err != nil {
		fmt.Println("Get:", err)
		return
	}

	httpData, err := c.Do(request)
	if err != nil {
		fmt.Println("Error in Do():", err)
		return
	}

	fmt.Println("Status code:", httpData.Status)
	// dump response
	header, _ := httputil.DumpResponse(httpData, false)
	fmt.Print(string(header))

	// get headers
	contentType := httpData.Header.Get("Content-Type")
	characterSet := strings.SplitAfter(contentType, "charset=")
	if len(characterSet) > 1 {
		fmt.Println("Character Set:", characterSet[1])
	}

	// content-length
	if httpData.ContentLength == -1 {
		fmt.Println("ContentLength is unknown!")
	} else {
		fmt.Println("ContentLength:", httpData.ContentLength)
	}

	length := 0
	var buffer [1024]byte
	r := httpData.Body
	for {
		n, err := r.Read(buffer[0:])
		if err != nil {
			fmt.Println(err)
			break
		}
		length = length + n
	}
	fmt.Println("Calculated response data length:", length)
}
