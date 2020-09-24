package main 

import (
  "encoding/json"
  // "fmt"
  "log"
  "net/http"
  "strconv"
  "time"

  "github.com/justinas/alice"
)

func main() {
  mainLogicHandler := http.HandlerFunc(mainLogic)

  /*
  curl --location --request POST 'localhost:9090/city'

  curl --location --request POST 'localhost:9090/city' \
  --header 'Content-Type: application/json' \
  --data-raw '{
      "Name": "what",
      "Area": 189
  }'

  */
  /*
  // without alice library
  http.Handle("/city",
    filterContentType( // content middleware
      setServerTimeCookie( // server time middleware
        mainLogicHandler,
      )))
  */

  // with alice
  chain := alice.New(filterContentType, setServerTimeCookie).Then(mainLogicHandler)
  http.Handle("/city", chain)

  http.ListenAndServe(":9090", nil)
}

type city struct {
  Name string
  Area uint64
}

func filterContentType(handler http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    log.Println("Currently in the check content type middleware")
    if r.Header.Get("Content-type") != "application/json" {
      w.WriteHeader(http.StatusUnsupportedMediaType)
      w.Write([]byte("415 - Unsupported Media Type. Please send JSON"))
      return
    }
    handler.ServeHTTP(w, r)
  })
}

func setServerTimeCookie(handler http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    handler.ServeHTTP(w, r)
    cookie := http.Cookie{
      Name: "Server-Time(UTC)",
      Value: strconv.FormatInt(time.Now().Unix(), 10),
    }
    // TODO it seems that cookie doesn't work
    http.SetCookie(w, &cookie)
    cookie2 := http.Cookie{
      Name: "yxtoken",
      Value: "tokenyx",
    }
    http.SetCookie(w, &cookie2)
    log.Println("Currently in the set server time middleware")
    // fmt.Printf("%q\n", cookie)
  })
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
    log.Printf("Got %s city with area of %d sq miles!\n", tempCity.Name, tempCity.Area)
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("201 - Created"))
  } else {
    w.WriteHeader(http.StatusMethodNotAllowed)
    w.Write([]byte("405 - Method Not Allowed"))
  }
}

