package main

import (
  "fmt"
  "log"
  "net/http"
  "time"
  "github.com/gorilla/mux"
)

func main() {
  r := mux.NewRouter()
  r.StrictSlash(true)
  r.HandleFunc("/articles/{category}/{id:[0-9]+}", ArticleHandler).Name("articleRoute")
  if url, err := r.Get("articleRoute").URL("category", "books", "id", "123"); err != nil {
    log.Fatal(err)
  } else {
    fmt.Println(url.String())
  }

  userRouter := r.PathPrefix("/users").Subrouter()
  // using http-GET for "/users"
  //          "/users/?age=12"
  userRouter.Methods("GET").Path("/").HandlerFunc(UserHandler)
  // if you write route like this,
  // it means the path has to include a query["age"]
  // otherwise it won't match the path, the handler won't execute
  // userRouter.Path("/").Queries("age", "{age}").HandlerFunc(UserHandler)

  // curl for "/users/{id}/settings
  userRouter.HandleFunc("/{id}/settings", UserSettingHandler)

  // curl for "/users/{id}"
  userRouter.Methods("GET").HandleFunc("/{id}", UserDetailHandler)

  srv := &http.Server{
    Handler: r,
    Addr: "127.0.0.1:9090",
    WriteTimeout: 15 * time.Second,
    ReadTimeout: 15 * time.Second,
  }

  log.Fatal(srv.ListenAndServe())
}

// ArticleHandler is a function handler
func ArticleHandler(w http.ResponseWriter, r *http.Request) {
  vars := mux.Vars(r)
  w.WriteHeader(http.StatusOK)
  fmt.Fprintf(w, "Category is: %v\n", vars["category"])
  fmt.Fprintf(w, "ID is: %v\n", vars["id"])
}

// UserHandler
func UserHandler(w http.ResponseWriter, r *http.Request) {
  queryParams := r.URL.Query()
  w.WriteHeader(http.StatusOK)
  fmt.Fprintf(w, "UserList is: %v\n", []string{"Shark","Sammy", "Octopus"})
  fmt.Fprintf(w, "Query is: %v\n", queryParams)
}
// UserSettingHandler
func UserSettingHandler(w http.ResponseWriter, r *http.Request) {
  vars := mux.Vars(r)
  w.WriteHeader(http.StatusOK)
  fmt.Fprintf(w, "UserSetting for ID: %v\n", vars["id"])
}
// UserDetailHandler
func UserDetailHandler(w http.ResponseWriter, r *http.Request) {
  // although we don't specify any query in the
  // router definition, we can still get access to them
  queryParams := r.URL.Query()
  vars := mux.Vars(r)
  w.WriteHeader(http.StatusOK)
  fmt.Fprintf(w, "UserDetail for ID: %v\n", vars["id"])
  fmt.Fprintf(w, "Query is: %v\n", queryParams)
  fmt.Fprintf(w, "Query[category] is: %v, %T\n", queryParams["category"], queryParams["category"])
}
