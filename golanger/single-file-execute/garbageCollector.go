package main

/**
	The GC runs concurrently with mutator threads,
	is type accurate (aka precise),
    allows multiple GC threads to run in parallel.
	It is a concurrent mark and sweep that uses a write barrier.
 	It is non-generational and non-compacting.
 	Allocation is done using size segregated per P allocation areas
   	to minimize fragmentation while eliminating locks in the common case.

	The operation of the Go garbage collector is based
   	on the `tricolor mark-and-sweep algorithm`.

	It can work concurrently with the program and uses a write barrier.
	This means that when a Go program runs, the Go scheduler
	is responsible for the scheduling of the application and the garbage collector
	as if the Go scheduler had to deal with a regular application
	with multiple goroutines.

	The objects of the black set are guaranteed to
	have no pointers to any object of the white set.
 	However, an object in the white set can have a pointer to
	an object of the black set, because this has no effect
	on the operation of the garbage collector!
	The objects of the grey set might have pointers to
	some objects of the white set.
	Also, the objects of the white set are candidates for garbage collection.

	When the garbage collection begins, all objects are white.
	The garbage collector visits all of the root objects and colors them grey.
	The roots are the objects that can be directly accessed by the application,
	which includes global variables and other things on the stack.
	These objects mostly depend on the Go code of a particular program.
	After this, the garbage collector picks a grey object, makes it black,
	and starts searching to determine if that object has pointers to
	other objects of the white set. This means that when a grey object
	is being scanned for pointers to other objects, it is colored black.
	If that scan discovers that this particular object has one or more pointers
	to a white object, it puts that white object in the grey set.
	This process keeps going for as long as objects exist in the grey set.
	After that, the objects in the white set are unreachable and their memory space can be reused.
	Therefore, at this point, the elements of the white set are said to be garbage collected.

	During this process, the running application is called the `mutator`.
	The mutator runs a small function named `write barrier`
	that is executed each time a pointer in the heap is modified.
	If the pointer of an object in the heap is modified,
	which means that this object is now reachable,
	the write barrier colors it grey and puts it in the grey set.

	> The mutator is responsible for the invariant
	> that no element of the black set has a pointer
	> to an element of the white set.
	> This is accomplished with the help of the write barrier function.
	> Failing to accomplish this invariant will
	> ruin the garbage collection process,
	> and it will most likely crash your program in an ugly and undesired way.

	Go allows you to initiate a garbage collection manually
	by putting a `runtime.GC()` statement in your Go code.

	> However, keep in mind that `runtime.GC()` will block the caller,
	> and it might block the entire program,
	> especially if you are running a very busy Go program with many objects.
	> This happens mainly because you cannot perform garbage collections
	> while everything else is rapidly changing,
	> as this will not give the garbage collector the opportunity to
	> identify clearly the members of the white, black, and grey sets!
	> This garbage collection status is also called the garbage collection safe-point.

	You can find the long and relatively advanced Go code of the garbage collector
	at https://github.com/golang/go/blob/master/src/runtime/mgc.go.

	Although the `stop-the-world mark-and-sweep` algorithm is simple,
	it suspends the execution of the program while it is running,
	which means that it adds latency to the actual process.
	Go tries to lower that particular "latency" by running the garbage collector
	as a concurrent process and using the `tricolor algorithm` described in the above section.
	However, other processes can move pointers or create new objects
	while the garbage collector runs concurrently.
	This fact can make things pretty difficult for the garbage collector.
	As a result, the principal point that allows the tricolor algorithm
	to run concurrently is to be able to maintain the fundamental invariant
	of the mark-and-sweep algorithm-no object of the
	"black set can point to an object of the white set".

	The solution to this problem is to fix all of the cases
	that can cause a problem for the algorithm!
	Therefore, new objects must go to the grey set,	because this way
	the fundamental invariant of the mark-and-sweep algorithm cannot be altered.
	Additionally, when a pointer of the program is moved,
	you color the object to which the pointer points as grey.
	You can say that the grey set acts like a barrier between the white set and the black set.
	Last, each time a pointer is moved, some Go code gets automatically executed,
	which is the write barrier mentioned earlier that does some recoloring.

	> The latency introduced by the execution of the write barrier code is
	> the price you have to pay for being able to run the garbage collector concurrently.
	> The Go garbage collector is a real- time garbage collector, which
	> runs concurrently with the other goroutines of a Go program
	> and only optimizes for low latency.
*/

import (
	"fmt"
	"runtime"
	"time"
)

func printStats(mem runtime.MemStats) {
	// each time to retrieve the more recent garbage collections statistics,
	// just call the runtime.ReadMemStats() function
	runtime.ReadMemStats(&mem)
	fmt.Println("mem.Alloc:", mem.Alloc)
	fmt.Println("mem.TotalAlloc:", mem.TotalAlloc)
	fmt.Println("mem.HeapAlloc:", mem.HeapAlloc)
	fmt.Println("mem.NumGC:", mem.NumGC)
	fmt.Println("-----")
}

/*
	run this file by `GODEBUG=gctrace=1 go run garbageCollector.go`
*/
func main() {
	var mem runtime.MemStats
	printStats(mem)

	for i := 0; i < 10; i++ {
		s := make([]byte, 50000000)
		if s == nil {
			fmt.Println("Operation failed!")
		}
	}
	printStats(mem)

	for i := 0; i < 10; i++ {
		s := make([]byte, 100000000)
		if s == nil {
			fmt.Println("Operation failed!")
		}
		time.Sleep(5 * time.Second)
	}
	printStats(mem)
}
