package main

import (
  "fmt"
  "html"
  "net/http"
  "strconv"
  "strings"
  "time"

  "github.com/AkatQuas/romanNumerals"
)

func main() {
  // http package has methods for dealing with requests
  http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
    urlPathElements := strings.Split(r.URL.Path, "/")
    if urlPathElements[1] == "roman_number" {
      number, _ := strconv.Atoi(strings.TrimSpace(urlPathElements[2]))
      if number < 1 || number > 10 {
        w.WriteHeader(http.StatusNotFound)
        w.Write([]byte("404 - Not Found"))
      } else {
        fmt.Fprintf(w, "%q", html.EscapeString(romanNumerals.Numerals[number]))
      }
    } else {
      w.WriteHeader(http.StatusBadRequest)
      w.Write([]byte("400 - Bad Request"))
    }
  })

  s := &http.Server{
    Addr: ":9090",
    ReadTimeout: 10 * time.Second,
    WriteTimeout: 10 * time.Second,
    MaxHeaderBytes: 1 << 20,
  }
  s.ListenAndServe()
}

