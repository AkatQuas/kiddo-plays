# DPC Game

Developing an application with TDD.

Put this project as a module like `$GOPATH/src/github.com/demo/dpc_game`.

> go version go1.16 darwin/amd64

## Test

In the project root.

```bash
go test
```

## start the http server

```bash
cd cmd/webserver
go run main.go

# get player boboka's score
curl --location --request GET 'http://localhost:5000/players/boboka'

# get player ame's score
curl --location --request POST 'http://localhost:5000/players/ame'

# record player boboka wins
curl --location --request POST 'http://localhost:5000/players/boboka'

# get league
curl --location --request GET 'http://localhost:5000/league'
```

## Start the CLI

```bash
cd cmd/cli

go run main.go
```

## An example of a function implementing an interface

In this list, `MockerFunc` function implements the `Mocke` interface.

```go
type Mocker interface {
  Spring(message string)
}

type MockerFunc func(message string)

func (fn MockerFunc) Spring(message string) {
  fn(message)
}
```
