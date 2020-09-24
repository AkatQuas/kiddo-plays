package main

import (
	"fmt"
	"os"
	"sync"
	"time"
)

type secret struct {
	RWM      sync.RWMutex
	password string
}

var Password = secret{password: "myPassword"}

func Change(c *secret, pass string) {
	c.RWM.Lock()
	fmt.Println("LChange")
	time.Sleep(5 * time.Second)
	c.password = pass
	c.RWM.Unlock()
}

// The show function uses the `RLock()` and `RUnlock()` functions
// because its critical section is used for reading a shared variable.
// this will not block for multiple reading,
// but block the writing until all the reading `RUnlock`
func show(c *secret, i int) string {
	c.RWM.RLock()
	fmt.Println("show, reading by",i)
	time.Sleep(2 * time.Second)
	defer c.RWM.RUnlock()
	return c.password
}

// showWithLock function uses an exclusive lock for reading,
// which means that only one showWithLock() function
// can read the password field of the secret structure at the same time.
// this is blocked both for reading, writing
func showWithLock(c *secret, i int) string {
	c.RWM.Lock()
	fmt.Println("showWithLock, reading by ",i )
	time.Sleep(2 * time.Second)
	defer c.RWM.Unlock()
	return c.password
}

func main() {
	var showFunction = func(c *secret, i int) string { return "" }
	if len(os.Args) != 2 {
		fmt.Println("Using sync.RWMutex!")
		showFunction = show
	} else {
		fmt.Println("Using sync.Mutex!")
		showFunction = showWithLock
	}

	var waitGroup sync.WaitGroup

	fmt.Println("Pass:", showFunction(&Password, 0))
	for i := 1; i < 15; i++ {
		waitGroup.Add(1)
		go func(i int) {
			defer waitGroup.Done()
			fmt.Println("Go Pass:", showFunction(&Password, i), "in index", i)
		}(i)
	}

	go func() {
		waitGroup.Add(1)
		defer waitGroup.Done()
		Change(&Password, "123456")
	}()

	waitGroup.Wait()
	fmt.Println("Pass:", showFunction(&Password, 100))
}
