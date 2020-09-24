package main

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"
)

var (
	myUrl string
	delay int = 5
	// a global `sync.WaitGroup` variable named w
	w     sync.WaitGroup
)

type myData struct {
	r   *http.Response
	err error
}

func connect(timeout int) error {
	c := context.Background()
	// The timeout period is defined by the `context.WithTimeout()` method.
	// The Client.Do() function that is executed as a goroutine will
	// either terminate normally or when the `cancel()` function is executed.
	c, cancel := context.WithTimeout(c, time.Duration(timeout)*time.Second)
	defer cancel()

	defer w.Done()

	data := make(chan myData, 1)

	tr := &http.Transport{}
	httpClient := &http.Client{Transport: tr}

	req, _ := http.NewRequestWithContext(c, "GET", myUrl, nil)

	go func() {
		response, err := httpClient.Do(req)
		if err != nil {
			fmt.Println(err)
			data <- myData{nil, err}
			return
		} else {
			pack := myData{response, err}
			data <- pack
		}
	}()

	select {
	case <-c.Done():
		// tr.CancelRequest(req)
		<-data
		fmt.Println("The request was cancelled!")
		return c.Err()
	case ok := <-data:
		err := ok.err
		resp := ok.r
		if err != nil {
			fmt.Println("Error select:", err)
			return err
		}
		defer resp.Body.Close()

		realHTTPData, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			fmt.Println("Error select:", err)
			return err
		}
		fmt.Printf("Server Response: %s\n", realHTTPData)

	}
	return nil
}

// go run contextWithHttp.go https://www.github.com 1
// go run contextWithHttp.go https://cn.bing.com 3

func main() {
	if len(os.Args) == 1 {
		fmt.Println("Need a URL and a delay!")
		return
	}

	myUrl = os.Args[1]
	if len(os.Args) == 3 {
		t, err := strconv.Atoi(os.Args[2])
		if err != nil {
			fmt.Println(err)
			return
		}
		delay = t
	}

	fmt.Println("Delay:", delay)

	fmt.Printf("Connecting to %s \n", myUrl)
	w.Add(1)
	go connect(delay)
	w.Wait()
	fmt.Println("Exiting...")
}
