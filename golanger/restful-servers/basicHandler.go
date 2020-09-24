package main

import (
  "io"
  "net/http"
  "log"
)

func MyServer(w http.ResponseWriter, req *http.Request) {
  io.WriteString(w, "hello, world!\n")
}

func main() {
  http.HandleFunc("/hello", MyServer)
  log.Fatal(http.ListenAndServe(":9090", nil))
}

