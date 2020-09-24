package main

// Calling C Code using the same file

//#include <stdio.h>
//void callC() {
//    printf("Calling C code!\n");
//}
import "C"
/*
   As you can see, the C code is included in the comments of the Go program.
    However, the go tool knows what to do with these kinds of comments
    because of the use of the C Go package.
*/

import "fmt"

func main() {
    fmt.Println("A Go statement!")
    C.callC()
    fmt.Println("Another Go statement!")
}
