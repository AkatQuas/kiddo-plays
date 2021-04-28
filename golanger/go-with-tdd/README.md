# Learn Go with tests

[Learn Go with tests](https://quii.gitbook.io/learn-go-with-tests/)

Put this project under `$GOPATH/src/github.com/demo`.

## Discipline

1. Write a test
1. Make the compiler pass
1. Write enough code to make the test pass
1. Refactor the code if necessary

Make it work, make it right, make it fast.

## Tips

[Tips on mocking in TDD](https://quii.gitbook.io/learn-go-with-tests/go-fundamentals/mocking#but-isnt-mocking-evil).

**When to use locks over channels and goroutines**

[wiki: Mutex or Channel](https://github.com/golang/go/wiki/MutexOrChannel)

1. Use channels when passing ownership of data (Communicating)
1. Use mutexes for managing state

## Local go documents

```bash
go get golang.org/x/tools/cmd/godoc

godoc -http :8090

open localhost:8090/pkg
```

Run `go test` in each sub folder.

`array-slice/`\
`concurrency/`\
`context/`\
`dependency_injection/`\
`dictionary/`\
`generics/`\
`hello/`\
`integers/`\
`iteration/`\
`pointers/`\
`reflection/`\
`sync/`

```bash
cd hello

go test
```
