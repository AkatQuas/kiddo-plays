package main 

import (
  "encoding/json"
  "fmt"
  "net/http"
)

func main() {
  /*
  $ curl --location --request POST 'localhost:9090/city' \
  --header 'Content-Type: application/json' \
  --data-raw '{
      "Name": "what",
      "Area": 189
  }'

  $ curl --location --request GET 'localhost:9090/city'
  */
  http.HandleFunc("/city", mainLogic)
  http.ListenAndServe(":9090", nil)
}


type city struct {
  Name string
  Area uint64
}

func mainLogic(w http.ResponseWriter, r *http.Request) {
  if r.Method == "POST" {
    var tempCity city
    decoder := json.NewDecoder(r.Body)
    err := decoder.Decode(&tempCity)
    if err != nil {
      panic(err)
    }
    defer r.Body.Close()

    fmt.Printf("Got %s city with area of %d sq miles!\n", tempCity.Name, tempCity.Area)

    w.WriteHeader(http.StatusOK)
    w.Write([]byte("201 - Created"))
  } else {
    w.WriteHeader(http.StatusMethodNotAllowed)
    w.Write([]byte("405 - Method Not Allowed"))
  }
}

