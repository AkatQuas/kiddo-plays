package main

import (
  "bytes"
  "fmt"
  "log"
  "net/http"
  "os"
  "os/exec"

  "github.com/julienschmidt/httprouter"
)

func main() {
  router := httprouter.New()
  router.GET("/api/v1/go-version", goVersion)
  router.GET("/api/v1/show-file/:name", getFileContent)
  if dir, err := os.Getwd(); err != nil {
    log.Fatal(err)
  } else {
    router.ServeFiles("/static/*filepath", http.Dir(dir + "/static"))
  }
  log.Fatal(http.ListenAndServe(":9090", router))
}

func getCommandOutput(command string, arguments ...string) string {
  // args... unpacks arguments array int elements
  cmd := exec.Command(command, arguments...)
  var out bytes.Buffer
  var stderr bytes.Buffer
  cmd.Stdout = &out
  cmd.Stderr = &stderr
  err := cmd.Start()
  if err != nil {
    log.Fatal(fmt.Sprint(err) + ":" + stderr.String())
  }
  err = cmd.Wait()
  if err != nil {
    log.Fatal(fmt.Sprint(err) + ":" + stderr.String())
  }
  return out.String()
}

func goVersion(w http.ResponseWriter, r *http.Request, params httprouter.Params) {
  fmt.Fprintf(w, getCommandOutput("/usr/local/bin/go", "version"))
}

func getFileContent(w http.ResponseWriter, r *http.Request, params httprouter.Params) {
  fmt.Fprintf(w, getCommandOutput("/bin/cat", params.ByName("name")))
}

