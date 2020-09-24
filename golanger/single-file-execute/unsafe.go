package main

import (
	"fmt"
	"unsafe"
)
/*
	Unsafe code is Go code that bypasses the type safety and the memory security of Go.
	Most of the time, unsafe code is related to pointers.

	The Go compiler implements the `unsafe` package when you import it into your programs
*/

func main() {
	basicUnsafe()
	moreUnsafe()
}

func basicUnsafe() {
	var value int64 = 5
	var p1 = &value
	// Note the use of the `unsafe.Pointer()` function here which allows you,
	// at your own risk, to create a int32 pointer named `p2`
	// that points to a int64 variable named value, which is accessed using the `p1` pointer.
	// Any Go pointer can be converted to `unsafe.Pointer`.
	var p2 = (*int32)(unsafe.Pointer(p1))

	fmt.Println("*p1: ", *p1)
	fmt.Println("*p2: ", *p2)
	*p1 = 5434123412312431212
	fmt.Println(value)
	fmt.Println("*p2: ", *p2)
	*p1 = 54341234
	fmt.Println(value)
	fmt.Println("*p2: ", *p2)
}

func moreUnsafe() {
	array := [...]int{0, 1, -2, 3, 4}
	pointer := &array[0]
	fmt.Print(*pointer, " ")
	// the `pointer` variable that points to an integer value is
	// converted to an `unsafe.Pointer()` function and then to `uintptr`
	memoryAddress := uintptr(unsafe.Pointer(pointer)) + unsafe.Sizeof(array[0])

	for i := 0; i < len(array)-1; i++ {
		pointer = (*int)(unsafe.Pointer(memoryAddress))
		fmt.Print(*pointer, " ")
		// The Go compiler cannot catch such a logical error
		// due to the use of the unsafe package
		// and therefore will return something inaccurate
		memoryAddress = uintptr(unsafe.Pointer(pointer)) + unsafe.Sizeof(array[0])
	}
	fmt.Println()
	pointer = (*int)(unsafe.Pointer(memoryAddress))
	fmt.Print("One more: ", *pointer, " ")
	memoryAddress = uintptr(unsafe.Pointer(pointer)) + unsafe.Sizeof(array[0])
	fmt.Println()
}
