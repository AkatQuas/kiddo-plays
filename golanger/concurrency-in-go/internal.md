# Goroutines and the Go Runtime

It's worth taking a moment to take a peek at how the runtime works, how it stitches everything together underthe covers.

However, you might find these hard to understand. Challenge yourself a bit!

## Work Stealing

Go runtime handles multiplexing goroutines onto OS threads for the developers. The algorithm it uses is known as a _work stealing_ strategy.

Before _work stealing_, there's a naive strategy called _fair scheduling_ for sharing work among processors. In an effort to ensure all processors were equally utilized, we could evenly, distribute the load between all available processors.

However, Go models concurrency using a fork-join model. In this fork-join paradigm, tasks are likely dependent on one another, and it turns out naively splitting them among processors will likely cause one of the processors to be underutilized, as well as it can lead to poor cache locality as tasks that require the same data are scheduled on other processors.

We give each processor its own thread and a doubl-ended queue, or _deque_.

The work stealing algorithm follows a few basic rules. Given a thread of execution:

1. At a fork point, add tasks to the tail of deque associated with the thread.

1. If the thread is idle, steal work from the head of deque associated with some other random thread.

1. At a join point that cannot be realized yet, pop work off the tail of the thread's own deque.

1. If the thread's deque is empty, either:

   - Stall at a join

   - Steal work from the head of a random thread's assocaited deque.

## Stealing Tasks or Continuations?

One thing we’ve kind of glossed over is the question of what work we are enqueuing and stealing. Under a fork-join paradigm, there are two options: tasks and continuations.

In Go, goroutines are tasks. Everything after a goroutine is called the continuation.

```go
var fib func(n int) <-chan int
fib = func(n int) <-chan int {
  result := make(chan int)
  /* tasks start */
  go func() {
    defer close(result)
    if n <= 2 {
      result <- 1
      return
    }
    result <- <-fib(n-1) + <-fib(n-2)
  }()
  /* tasks end */
  /* after goroutine, continuation */
  return result
}
```

In the previous walkthrough of a distributed-queue work-stealing algorithm, Go runtime were enqueuing _tasks_, or goroutines. Since a goroutine hosts functions that nicely encapsulate a body of work, this is a natural way to think about things.

However, this is not actually how Go’s work-stealing algorithm works. Go’s work-stealing algorithm enqueues and steals **_continuations_**.

To begin answering this question, let’s look at the program join points.

Under the algorithm, when a thread of execution reaches an _unrealized join point_, the thread must pause execution and go fishing for a task to steal. This is called a _stalling join_ because it is _stalling at the join while looking for work to do_. Both task-stealing and continuation-stealing algorithms have stalling joins, but there is a significant difference in how often stalls occur.

Consider this: when creating a goroutine, it is very likely that your program will want the function in that goroutine to execute. It is also reasonably likely that the continuation from that goroutine will at some point want to join with that goroutine. And it’s not uncommon for the continuation to attempt a join before the goroutine has finished completing.

Now think back to the properties of a thread pushing and popping work to/from the tail of its deque, and other threads popping work from the head. If we push the continuation onto the tail of the deque, it’s least likely to get stolen by another thread that is popping things from the head of the deque, and therefore it becomes very likely that we’ll be able to just pick it back up when we’re finished executing our goroutine, thus avoiding a stall. This also makes the forked task look a lot like a function call: the thread jumps to executing the goroutine and then returns to the continuation after it’s finished.

Go performs additional optimizations. Before we analyze those, let’s set the stage by starting to use the Go scheduler’s nomenclature as laid out in the source code.

From the Go scheduler's perspective, there are primarily three entities:

- Goroutine (G)

  Goroutine is the logical unit of execution that contains teh actual instructions.

  When the Go program starts, a goroutine called main goroutine is first launched, and it takes care of setting up the runtime space before starting the program.

- OS thread or machine (M)

  Initially, the OS threads or machines are created by and managed by the OS. Later on, the scheduler can request for more OS threads or machines to be created or destroyed. It is the actual resource upon which a goroutine will be executed. It also maintains information about the main goroutine.

- Context or processor (P)

  The program has a global scheduler which takes care of bringing up new OS thread, registering Goroutine, and handling system calls. However, it does not handle the actual execution of goroutines. This is done by an entity called Processor, which has its own internal scheduler and a queue called runqueue (`runq` in code) consisting of goroutines that will be executed in the current context. It also handles switching between various goroutines.

By the time the program is ready to start executing, the runtime would request the OS to start an ample number of Machines, GOMAXPROCS number of Processors to execute goroutines. It's important to understand that OS thread is the actual unit of execution and goroutine is teh logical unit of execution. However, they require context to actually execute goroutine against the OS thread.

The `GOMAXPROCS` setting controls how many contexts are available for use by the runtime. The default setting is for there to be one context per logical CPU on the host machine. Unlike contexts, there may be more or less OS threads than cores to help Go's runtime manage things like garbage collection and goroutines. The runtime also contains a thread pool for threads that aren't currently being utilized.

Consider what would happen if any of the goroutines were blocked either by input/ output or by making a system call outside of Go’s runtime. The OS thread that hosts the goroutine would also be blocked and would be unable to make progress or host any other goroutines. Logically, this is just fine, but from a performance perspective, Go could do more to keep processors on the machine as active as possible.

What Go does in this situation is dissociate the context from the OS thread so that the context can be handed off to another, unblocked, OS thread. This allows the context to schedule further goroutines, which allows the runtime to keep the host machine’s CPUs active. The blocked goroutine remains associated with the blocked thread.

When the goroutine eventually becomes unblocked, the host OS thread attempts to steal back a context from one of the other OS threads so that it can continue execut‐ ing the previously blocked goroutine. However, sometimes this is not always possible. In this case, the thread will place its goroutine on a global context, the thread will go to sleep, and it will be put into the runtime’s thread pool for future use.

The global context we just mentioned doesn’t fit into our prior discussions of abstract work-stealing algorithms. It’s an implementation detail that is necessitated by how Go is optimizing CPU utilization. To ensure that goroutines placed into the global con‐ text aren’t there perpetually, a few extra steps are added into the work-stealing algo‐ rithm. Periodically, a context will check the global context to see if there are any goroutines there, and when a context’s queue is empty, it will first check the global context for work to steal before checking other OS threads’ contexts.

Other than input/output and system calls, Go also allows goroutines to be preempted during any function call. This works in tandem with Go’s philosophy of preferring very fine-grained concurrent tasks by ensuring the runtime can efficiently schedule work. One notable exception that the team has been trying to solve is goroutines that perform no input/output, system calls, or function calls. Currently, these kinds of goroutines are not preemptable and can cause significant issues like long GC waits, or even deadlocks. Fortunately, from an anecdotal perspective, this is a vanishingly small occurrence.
