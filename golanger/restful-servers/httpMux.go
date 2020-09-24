package main

import (
	"fmt"
	"math/rand"
	"net/http"
	"net/http/pprof"
	"os"
	"time"
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

func myHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "Serving: %s\n", r.URL.Path)
	fmt.Printf("Served: %s\n", r.Host)
}

func timeHandler(w http.ResponseWriter, r *http.Request) {
	t := time.Now().Format(time.RFC1123)
	Body := "The current time is:"
	fmt.Fprintf(w, "<h1 align=\"center\">%s</h1>", Body)
	fmt.Fprintf(w, "<h2 align=\"center\">%s</h2>\n", t)
	fmt.Fprintf(w, "Serving: %s\n", r.URL.Path)
	fmt.Printf("Served time for: %s\n", r.Host)
}

/*
	go run httpMux.go 1234

	go tool pprof http://localhost:1234/debug/pprof/profile
*/
func main() {
	PORT := ":8001"
	arguments := os.Args
	if len(arguments) == 1 {
		fmt.Println("Using default port number: ", PORT)
	} else {
		PORT = ":" + arguments[1]
		fmt.Println("Using port number: ", PORT)
	}

	r := http.NewServeMux()
	r.HandleFunc("/randomFloat", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, rand.Float64())
	})

	r.HandleFunc("/randomInt", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "<h1>%d</h1>", rand.Intn(100))
	})
	r.HandleFunc("/time", timeHandler)

	r.HandleFunc("/debug/pprof/", pprof.Index)
	r.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
	r.HandleFunc("/debug/pprof/profile", pprof.Profile)
	r.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
	r.HandleFunc("/debug/pprof/trace", pprof.Trace)


	r.HandleFunc("/", myHandler)


	http.ListenAndServe(":9090", r)
}
