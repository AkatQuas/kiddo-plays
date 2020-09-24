package main

import (
  "fmt"
  "io"
  "net/http"
  "time"

  "github.com/emicklei/go-restful"
)

func main() {
  // Create a web service
  webservice := new(restful.WebService)

  // Create a route and attach it to handler in the service
  webservice.Route(webservice.GET("/ping").To(pingTime))
  fmt.Printf("%T, %v", webservice.GET("/ping"), webservice.GET("/ping"))

  // ADd the service to application
  restful.Add(webservice)

  /*
  curl --location --request GET 'localhost:9090/ping'
  */
  http.ListenAndServe(":9090", nil)
}

func pingTime(req *restful.Request, resp *restful.Response) {
  io.WriteString(resp, fmt.Sprintf("%s", time.Now()))
}
