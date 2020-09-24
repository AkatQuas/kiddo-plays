# Concurrency Patterns in Go

Compose these concurrency primitives properly will help to keep the program scalable and maintainable.

## Confinement

When working with concurrent code, there are a few different options for safe operation. The two of them are:

- Synchronization primitives for sharing memory (e.g., sync.Mutex)

- Synchronization via communicating (e.g., channels)

However, there are a couple of other options that are implicitly safe within multiple concurrent processes:

- Immutable data

- Data protected by confinement

In some sense, immutable data is ideal because it is implicitly concurrent-safe. Each concurrent process may operate on the same data, but it may not modify it. If it wants to create new data, it must create a new copy of the data with the desired modifications. This allows not only a lighter cognitive load on the developer, but can also lead to faster programs if it leads to smaller critical sections (or eliminates them altogether). In Go, you can achieve this by writing code that utilizes copies of values instead of pointers to values in memory.

Confinement can also allow for a lighter cognitive load on the developer and smaller critical sections. The techniques to confine concurrent values are a bit more involved than simply passing copies of values.

Confinement is the simple yet powerful idea of ensuring information is only ever available from one concurrent process. When this is achieved, a concurrent program is implicitly safe and no synchronization is needed. There are two kinds of confinement possible: **ad hoc** and **lexical**.

Ad hoc confinement is when you achieve confinement through a convention— whether it be set by the languages community, the group you work within, or the codebase you work within, which is difficult to sticking to unless there are some tools to perform static analysis on the code every commits.

Lexical confinement involves using lexical scope to expose only the correct data and concurrency primitives for multiple concurrent processes to use.

```go
chanOwner := func() <-chan int {
  // instantiate a buffered channel within the lexical scoped.
  // This confines the scope of the write aspect of the `resultStream`
  // to prevent other goroutines from writing to it
  resultStream := make(chan int, 5)

  go func() {
    defer close(resultStream)
    for i := 0; i <= 5; i ++ {
      resultStream <- i
    }
  }()
  // expose read-only aspect for other goroutines
  return resultStream
}

consumer := func(resultStream <-chan int) {
  // By declaring the read-only usage,
  // confine the consumer function only read aspect of the channel
  for result := range resultStream {
    fmt.Printf("Received: %d\n", result)
  }
  fmt.Println("Done Receiving!")
}

resultStream := chanOwner()
consumer(resultStream)
```

Why pursue confinement if we have synchronization available to us? The answer is improved performance and reduced cognitive load on developers. Synchronization comes with a cost, and if you can avoid it you won’t have any critical sections, and therefore you won’t have to pay the cost of synchronizing them.

Concurrent code that utilizes lexical confinement also has the benefit of usually being simpler to understand than concurrent code without lexically confined variables. This is because within the context of your lexical scope you can write synchronous code.

## The for-select Loop

```go
for { // Either loop infinitely or range over something
  select {
    // Do some work with channels
  }
}
```

### _Sending iteration variables out on a channel_

```go
for _, v := range <iterator> {
  select {
    case <-done:
      return
    case stringStream <- s:
  }
}
```

### _Looping infinitely waiting to be stopped_

```go
for {
  select {
    case <-done:
      return
    default:

  }
  // Do non-preemptable work
}
// or
for {
  select {
    case <-done:
      return
    default:
      // Do non-preemptable work
  }
}
```

## Preventing Goroutine Leaks

Though the Go runtime handles multiplexing the goroutines onto any number of operating system threads so that we don’t often have to worry about that level of abstraction. But goroutines do cost resources, and they are not garbage collected by the runtime, so regardless of how small their memory footprint is, it's important to not to leave them lying about our process.

Before we go about ensuring to clean up goroutines, how a goroutine would terminate.

The goroutine has a few paths to termination:

- When it has completed its work.

- When it cannot continue its work due to an unrecoverable error.

- When it’s told to stop working, timeout for example.

The third path is something about work cancellation. Mostly, we could even represent this interconnectedness as a graph: whether or not a child goroutine should continue executing might be predicated on knowledge of the state of many other goroutines. The parent goroutine (often the main goroutine) with this full contextual knowledge should be able to tell its child goroutines to terminate.

The way to successfully mitigate this is to establish a signal between the parent goroutine and its children that allows the parent to signal cancellation to its children. By convention, this signal is usually a read-only channel named `done`. The parent goroutine passes this channel to the child goroutine and then closes the channel when it wants to cancel the child goroutine.

```go
// As a convention, this `done` channel is the first parameter.
doWork := func(
  done <-chan interface{},
  strings <-chan string,
) <-chan interface{} {
  terminated := make(chan interface{})
  go func() {
    defer fmt.Println("doWork exited.")
    defer close(terminated)
    for {
      select {
      case s := <-strings:
        // Do something interesting
        fmt.Println(s)
      case <-done:
        // Once signaled, the goroutine terminates
        return
      }
    }
  }()
  return terminated
}

done := make(chan interface{})
terminated := doWork(done, nil)

go func() {
  // Cancel the operation
  time.Sleep(1 * time.Second)
  fmt.Println("Canceling doWork goroutine...")
  close(done)
}()

// the join-point of goroutines spawned
// from doWork with the main goroutine
<-terminated
fmt.Println("All Done.")
```

```go
newRandStream := func(done <-chan interface{}) <-chan int {
  randStream := make(chan int)
  go func() {
    defer fmt.Println("newRandStream Closure exited.")
    defer close(randStream)
    for {
      select {
      case randStream <- rand.Int():
      case <-done:
        return
      }
    }
  }()
  return randStream
}

done := make(chan interface{})
randStream := newRandStream(done)
fmt.Println("3 random ints:")
for i := 1; i <= 3; i++ {
  fmt.Printf("%d: %d\n", i , <-randStream)
}
close(done)
time.Sleep(1 * time.Second)
```

Now that we know how to ensure goroutines don’t leak, we can stipulate a convention: **If a goroutine is responsible for creating a goroutine, it is also responsible for ensuring it can stop the goroutine**.

## The or-channel

At times you may find yourself wanting to combine one or more `done` channels into a single done channel that closes if any of its component channels close.

```go
var or func(channels ...<-chan interface{}) <-chan interface{}

// a function takes in a variadic slice of channels
// and returns a single channel
or = func(channels ...<-chan interface{}) <-chan interface{} {
  switch len(channels) {
  case 0:
    // set up termination criteria for recursive
    return nil
  case 1:
    // the variadic slice only contains one element
    return channels[0]
  }

  orDone := make(chan interface{})
  // the main body of the function, and where the recursion happens
  // use a goroutine to return the channel without blocking
  go func() {
    defer close(orDone)
    switch len(channels) {
    case 2:
      select {
      case <-channels[0]:
      case <-channels[1]:
      }
    default:
      select {
      case <-channels[0]:
      case <-channels[1]:
      case <-channels[2]:
      // recursively create an or-channel from
      // all the channels in the slice after
      // the third index.
      // By passing in the orDone channel,
      // so that when goroutines up the tree exit,
      // goroutines down the tree also exit.
      case <-or(append(channels[3:], orDone)...):
      }
    }
  }()
  return orDone
}

// a small example to use or-funtion
// to combine channels into a single channel
sig := func(after time.Duration) <-chan interface{} {
  c := make(chan interface{})
  go func() {
    defer close(c)
    time.Sleep(after)
  }()
  return c
}
start := time.Now()
<-or (
  sig(2*time.Hour),
  sig(5*time.Minute),
  sig(1*time.Second),
  sig(1*time.Hour),
  sig(1*time.Minute),
)
fmt.Printf("done after %v", time.Since(start))
```

> This is because—despite its place in the tree the or function builds—it will always close first and thus the channels that depend on its closure will close as well.

This pattern is useful to employ at the intersection of modules in your system. At these intersections, you tend to have multiple conditions for canceling trees of goroutines through your call stack. Using the `or` function, you can simply combine these together and pass it down the stack.

## Error Handling in Concurrency

Generally, the concurrent processes should send their errors to another part of the program that has complete information about the state of the program, and can make a more informed decision about what to do.

```go
type Result struct {
  Error error
  Response *http.Response
}

checkStatus := func(done <-chan interface{}, urls ...string) <-chan Result {
  results := make(chan Result)
  go func() {
    defer close(results)
    for _, url := range urls {
      var result Result
      resp, err := http.Get(url)
      result = Result{Error: err, Response: resp}
      select {
      case <-done:
      case results <- result:
      }
    }
  }()
  return results
}
done := make(chan interface{})
defer close(done)

errCount := 0
urls := []string{"https://badhost", "https://cn.bing.com", "a", "b", "c"}

for result := range checkStatus(done, urls...) {
  if result.Error != nil {
    fmt.Printf("error: %v", result.Error)
    errCount++
    if errCount >= 3 {
      fmt.Println("Too many errors, breaking!")
      break
    }
    continue
  }
  fmt.Printf("Response: %v\n", result.Response.Status)
}
```

The above is a good example because we've coupled the potential result with the potential error. This represents the complete set of possible outcomes created from the goroutine `checkStatus`, and allows the main goroutine to make decisions about what to do when errors occur.

In broader terms, we’ve successfully separated the concerns of error handling from our producer goroutine. This is desirable because the goroutine that spawned the producer goroutine has more context about the running program, and can make more intelligent decisions about what to do with errors.

Errors should be considered first-class citizens when constructing values to return from goroutines. If your goroutine can produce errors, those errors should be tightly coupled with your result type, and passed along through the same lines of communication—just like regular synchronous functions.

## Pipelines

A pipeline is just another tool you can use to form an abstraction in your system. In particular, it is a very powerful tool to use when your program needs to process streams, or batches of data. A pipeline is nothing more than a series of things that take data in, perform an operation on it, and pass the data back out. We call each of these operations a _stage_ of the pipeline.

By using a pipeline, you separate the concerns of each stage, which provides numerous benefits. You can modify stages independent of one another, you can mix and match how stages are combined independent of modifying the stages, you can process each stage concurrent to upstream or downstream stages, and you can fan-out, or rate-limit portions of your pipeline.

A stage is just something that takes some data in, performs a transformation on it, and sends some data back out.

1. A stage consums and retruns _the same type_.

1. A stage must be reified by the language so that it may be passed around. Functions in Go are reified and fit this purpose nicely.

Pipeline stages are very closely related to functional programming and can be considered a subset of monads.

Notice how each stage is taking a slice of data and returning a slice of data? These stages are performing what we call _batch processing_. This just means that they operate on chunks of data all at once instead of one discrete value at a time. There is another type of pipeline stage that performs _stream processing_. This means that the stage receives and emits one element at a time.

### Constructing Pipelines with channels

Channels can receive and emit values, they can safely be used concurrently, they can be ranged over, and they are reified by the language.

<details>

<summary>

An example utilizing channels to pipeline.

</summary>

```go
// generator converts a discrete set of values
// into a stream of data on a channel
generator := func(done <-chan interface{}, integers ...int) <-chan int {
  intStream := make(chan int)
  go func() {
    defer close(intStream)
    for _, i := range integers {
      select {
      case <-done:
        // ensures the program exits cleanly
        // and never leaks goroutines.
        return
      case intStream <- i:
      }
    }
  }()
  return intStream
}

multiply := func (
  done <-chan interface{},
  intStream <-chan int,
  multiplier int,
) <-chan int {
  multipliedStream := make(chan int)
  go func() {
    defer close(multipliedStream)
    for i := range intStream {
      select {
      case <-done:
        // ensures the program exits cleanly
        // and never leaks goroutines.
        return
      case multipliedStream <- i * multiplier:
      }
    }
  }()
  return multipliedStream
}

add := func (
  done <-chan interface{},
  intStream <-chan int,
  additive int,
) <-chan int {
  addStream := make(chan int)
  go func() {
    defer close(addStream)
    for i := range intStream {
      select {
      case <-done:
        // ensures the program exits cleanly
        // and never leaks goroutines.
        return
      case addStream <- i + multiplier:
      }
    }
  }()
  return addStream
}

done := make(chan interface{})
defer close(done)

intStream := generator(done, 1, 2, 4, 3)
pipeline := multiply(done, add(done, multiply(done, intStream, 2), 1), 2)

for v := range pipeline {
  fmt.Println(v)
}
```

```go
repeat := func(
  done <-chan interface{},
  values ...interface{},
) <-chan interface{} {
  valueStream := make(chan interface{})
  go func() {
    defer close(valueStream)
    for {
      for _, v := range values {
        select {
        case <-done: return
        case valueStream <- v:
        }
      }
    }
  }()
  return valueStream
}

repeatFn := func(
  done <-chan interface{},
  fn func() interface{},
) <-chan interface{} {
  valueStream := make(chan interface{})
  go func() {
    defer close(valueStream)
    for {
      for _, v := range values {
        select {
        case <-done: return
        case valueStream <- fn():
        }
      }
    }
  }()
  return valueStream
}
```

</details>

If one of your stages is computationally expensive, this will certainly eclipse this performance overhead. So to help mitigate this, we adopt the _fan-out, fan-in_ technique.

Sometimes, stages in the pipeline can be particularly computationally expensive. When it happens, upstream stages in the pipeline can become blocked while waiting for the expensive stages to complete.

It would be interesting to reuse a single stage of our pipeline on multiple goroutines in an attempt to parallelize pulls from an upstream stage

_Fan-out_ is a term to describe the process of starting multiple goroutines to handle input from the pipeline, and _fan-in_ is a term to describe the process of combining multiple results into one channel.

> The _fan-out, fan-in_ technique works only when the input and output is order-independence, because there's no guarantee in what order concurrent copies of the stage will run.

**Fan-in** means _multiplexing_ or joining together multiple streams of data into a single stream. The algorithm to do so is relatively simple:

```go
fanIn := func (
  done <-chan interface{},
  channels ...<-chan interface{},
) <-chan interface{} {
  var wg sync.WaitGroup
  multiplexedStream := make(chan interface{})

  multiplex := func (c <-chan interface{}) {
    defer wg.Done()
    for i := range c {
      select {
      case <-done:
        return
      case multiplexedStream <- i:
      }
    }
  }

  // Select from all the channels
  wg.Add(len(channels))
  for _, c := range channels {
    go multiplex(c)
  }

  // Wait for all the reads to complete
  go func() {
    wg.Wait()
    close(multiplexedStream)
  }()

  return multiplexedStream
}
```

In a nutshell, _fanning in_ involves creating one multiplexed channel consumers will read from, and then spinning up one goroutine for every incoming channel, and one goroutine to close the multiplexed channel when the incoming channels have all been closed.

### The or-done-channel

<details>

<summary>

At times you will be working with channels from disparate parts of your system. Unlike with pipelines, you can’t make any assertions about how a channel will behave when code you’re working with is canceled via its `done` channel.

</summary>

We encapsulate the verbosity of creating or-done-channel:

```go
orDone := func(done, c <-chan interface{}) <-chan interface{} {
  valStream := make(chan interface{})
  go func() {
    defer close(valStream)
    for {
      select {
      case <-done:
        return
      case v, ok := <-c:
        if ok == false {
          return
        }
        select {
        case valStream <- v:
        case <-done:
        }
      }
    }
  }()
  return valStream
}
```

</details>

### The tee-channel

<details>

<summary>

Sometimes you may want to split values coming in from a channel so that you can send them off into two separate areas of your codebase.

</summary>

Taking its name from the `tee` command in Unix-like systems, the _tee-channel_ does just this. You can pass it a channel to read from, and it will return two separate channels that will get the same value:

```go
tee := func (
  done <-chan interface{},
  in <-chan interface{},
) (_, _ <-chan interface{}) {
  out1 := make(chan interface{})
  out2 := make(chan interface{})

  go func() {
    defer close(out1)
    defer close(out2)
    for val := range orDone(done, in) {
      // use local versions of out1 and out2,
      // so we shadow these variables.
      var out1, out2 = out1, out2

      // use one select statement so that
      // writes to out1 and out2 don’t block each other.
      //  To ensure both are written to,
      // we’ll perform two iterations of the select statement:
      // one for each outbound channel.
      for i := 0; i < 2; i++ {
        select {
        case <-done:
        case out1<-val:
          out1 = nil
        case out2<-val:
          out2 = nil
        }

        // Once we’ve written to a channel,
        // we set its shadowed copy to nil
        // so that further writes will block
        // and the other channel may continue
      }
    }
  }()
  return out1, out2
}
```

</details>

<details>

<summary>

### The bridge-channel

In some circumstances, you may find yourself wanting to consume values from a sequence of channels:

```go
<-chan <-chan interface{}
```

As a consumer, the code may not care about the fact that its values come from a sequence of channels. In that case, dealing with a channel of channels can be cumbersome. If we instead define a function that can destructure the channel of channels into a simple channel—a technique called _bridging_ the channels—this will make it much easier for the consumer to focus on the problem at hand.

</summary>

Here’s how we can achieve that:

```go
bridge := func(
  done <-chan interface{},
  chanStream <-chan <-chan interface{},
) <-chan interface{} {
  // This is the bridge that will return all values
  valStream := make(chan interface{})
  go func() {
    defer close(valStream)
    // this loop is responsible for pulling
    // channels off of chanStream and providing
    // them to a nested loop for use
    for {
      var stream <-chan interface{}
      select {
      case maybeStream, ok := <-chanStream:
        if ok == false {
          return
        }
      case <-done:
        return
      }

      // this loop is responsible for reading values off the channel
      // and repeating those values onto valStream
      for val := range orDone(done, stream) {
        select {
        case valStream <- val:
        case <-done:
        }
      }
    }
  }()
  return valStream
}
```

</details>

<details>

<summary>

## Queuing

Sometimes it’s useful to begin accepting work for your pipeline even though the pipeline is not yet ready for more. This process is called _queuing_.

All this means is that once your stage has completed some work, it stores it in a temporary location in memory so that other stages can retrieve it later, and your stage doesn’t need to hold a reference to it.

Queuing is usually one of the last techniques you want to employ when optimizing the program. Adding queuing prematurely can hide synchronization issues such as deadlocks and livelocks.

Queuing will almost never speed up the total runtime of your program; it will only allow the program to behave differently. The runtime of one of stages does not reduced vastly, but rather the time it's in a _blocking state_ is reduced. This allows the stage to continue doing its job more quickly.

</summary>

In this way, the true utility of queues is to _decouple stages_ so that the runtime of one stage has smaller impact on the runtime of another.

Usually anytime performing an operation requires an overhead, chunking may increase system performance. Some examples of this are opening database transactions, calculating message checksums, and allocating contiguous space. Aside from chunking, queuing can also help if your algorithm can be optimized by supporting lookbehinds, or ordering.

Queuing should be implemented either:

- At the entrance to the pipelie

- In stages where batching will lead to higher effciency

In queuing theory, there's a law that predicts the throughput of the pipeline, which is called _Little's Law_.

The Little's Law is commonly expressed as: `L=λW`, where:

- L = the average number of units in the system.
- λ = the average arrival rate of units.
- W = the average time a unit spends in the system.

This equation only applies to so-called _stable_ systems. In a pipeline, a stable system is one in which the rate that work enters the pipeline, or _ingress_, is equal to the rate in which it exits the system, or _egress_.

If the rate of ingress exceeds the rate of egress, your system is _unstable_ and has entered a _death-spiral_. If the rate of ingress is less than the rate of egress, you still have an _unstable_ system, but all that’s happening is that your resources aren’t _being utilized completely_.

If we want to decrease `W`, the average time a unit spends in the system by a factor of `n`, we only have one option: to decrease the average number of units in the system: `L/n = λ * W/n`. And we can only decrease the average number of units in the system if we increase the rate of egress. Also notice that if we add queues to our stages, we’re increasing `L`, which either increases the arrival rate of units (`nL = nλ * W`) or increases the average time a unit spends in the system (`nL = λ * nW`). Through Little’s Law, we have proven that _queuing will not help decrease the amount of time spent in a system_.

Also notice that since we’re observing our pipeline as a whole, reducing `W` by a factor of `n` is distributed throughout all stages of our pipeline. In our case, Little’s Law should really be defined like this:

`L = λΣiWi`

That’s another way of saying that your pipeline will only be as fast as your slowest stage. Optimize indiscriminately!

</details>

## The `context` Package

In concurrent programs, it's often necessary to preempt operations because of timeouts, cancellation, or failure of another portion of the system.

It would be useful if we could communicate extra information alongside the simple notification to cancel: why the cancellation is occuring, or whether or not the function has a deadline by which it needs to complete.

It turns out that the need to wrap a done channel with this information is very common in systems of any size, and so the Go authors decided to create a standard pattern for doing so, the `context` package.

The context package serves two primary purposes:

- To provide an API for canceling branches of the call-graph

- To provide a data-bag for transporting requset-scoped data through the call-graph

The `context` package helps to cancel a function in three aspects:

- A goroutine's parent may want to cancel it.

- A goroutine may want to cancel its children.

- Any blocking operations within a goroutine need to be preemptable so that it may be canceled.

```go
func WithCancel(parent Context) (ctx Context, cancel CancelFunc)
func WithDeadline(parent Context, deadline time.Time) (Context, CancelFunc)
func WithTimeout(parent Context, timeout time.Duration) (Context, CancelFunc)
```

All these functions take in a `Context` and return one as well. If the function needs to cancel functions below it in the call-graph in some manner, it will call one of these functions and pass in the `Context` it was given, and then pass the `Context` returned into its children. If the function doesn’t need to modify the cancellation behavior, the function simply passes on the `Context` it was given.

In this way, successive layers of the call-graph can create a `Context` that adheres to their needs without affecting their parents. This provides a very composable, elegant solution for how to manage branches of your call-graph.

In this spirit, instances of a `Context` are meant to flow through your program’s call-graph. In an object-oriented paradigm, it’s common to store references to often-used data as member variables, but it’s important to **not do this** with instances of `context.Context`. Instances of `context.Context` may look equivalent from the out‐side, but **internally they may change at every stack-frame**. For this reason, it’s important to **always pass instances of `Context`** into your functions. This way functions have the Context intended for it, and not the Context intended for a stack-frame `N` levels up the stack.

At the top of your asynchronous call-graph, your code probably won’t have been passed a Context. To start the chain, the context package provides you with two functions to create empty instances of Context:

```go
func Background() Context
func TODO() Context
```

`Background` simply returns an empty `Context`. `TODO` is not meant for use in production, but also returns an empty `Context`; `TODO`’s intended purpose is to serve as a placeholder for when you don’t know which `Context` to utilize, or if you expect your code to be provided with a `Context`, but the upstream code hasn’t yet furnished one.

<details>

<summary>

An example that uses the `done` channel pattern, and another example that use the `context` package.

</summary>

```go
func main() {
  var wg sync.WaitGroup
  done := make(chan interface{})
  defer close(done)

  wg.Add(1)
  go func() {
    defer wg.Done()
    if err := printGreeting(done); err != nil {
      fmt.Printf("printGreeting result: %v\n", err)
      return
    }
  }()

  wg.Add(1)
  go func() {
    defer wg.Done()
    if err := printFarewell(done); err != nil {
      fmt.Printf("printFarewell result: %v\n", err)
      return
    }
  }()

  // go func() {
  //   time.Sleep(3 * time.Second)
  //   done <- 1
  //   time.Sleep(3 * time.Second)
  //   done <- 1
  // }()

  // go func() {
  //   time.Sleep(3 * time.Second)
  //   close(done)
  // }()

  wg.Wait()
}

func printFarewell(done <-chan interface{}) error {
  farewell, err := genFarewell(done)
  if err != nil {
    return err
  }
  fmt.Printf("%s world!\n", farewell)
  return nil
}

func genFarewell(done <-chan interface{}) (string, error) {
  switch locale, err := locale(done); {
  case err != nil:
    return "", err
  case locale == "EN/US":
    return "goodbye", nil
  }
  return "", fmt.Errorf("unsupported locale")
}

func printGreeting(done <-chan interface{}) error {
  greeting, err := genGreeting(done)
  if err != nil {
    return err
  }
  fmt.Printf("%s world!\n", greeting)
  return nil
}

func genGreeting(done <-chan interface{}) (string, error) {
  switch locale, err := locale(done); {
  case err != nil:
    return "", err
  case locale == "EN/US":
    return "hello", nil
  }
  return "", fmt.Errorf("unsupported locale")
}

func locale(done <-chan interface{}) (string, error) {
  select {
  case <-done:
    return "", fmt.Errorf("locale canceled")
  case <-time.After(15 * time.Second):
  }
  return "EN/US", nil
}
```

We’ve set up the standard preemption method by creating a done channel and passing it down through our call-graph. If we close the done channel at any point in main, both branches will be canceled.

By introducing goroutines in main, we’ve opened up the possibility of controlling this program in a few different and interesting ways. Maybe we want `genGreeting` to time out if it takes too long. Maybe we don’t want `genFarewell` to invoke locale if we know its parent is going to be canceled soon. _At each stack-frame, a function can affect the entirety of the call stack below it_.

Using the `done` channel pattern, we could accomplish this by wrapping the incoming `done` channel in other `done` channels and then returning if any of them fire, but we wouldn’t have the extra information about deadlines and errors a `Context` gives us.

```go

func main() {
  var wg sync.WaitGroup
  // creates a new Context with context.Background()
  // and wraps it with context.WithCancel to allow for cancellations.
  ctx, cancel := context.WithCancel(context.Background())
  defer cancel()

  wg.Add(1)
  go func() {
    defer wg.Done()
    if err := printGreeting(ctx); err != nil {
      fmt.Printf("cannot print greeting: %v\n", err)
      // main will cancel the Context
      // if there is an error returned from print Greeting.
      // if greeting encounter some error, it will cancel the main.ctx
      cancel()
    }
  }()

  wg.Add(1)
  go func() {
    defer wg.Done()
    if err := printFarewell(ctx); err != nil {
      fmt.Printf("cannot print farewell: %v\n", err)
    }
  }()

  wg.Wait()
}

func printFarewell(ctx context.Context) error {
  // simply pass the ctx down
  farewell, err := genFarewell(ctx)
  if err != nil {
    return err
  }
  fmt.Printf("%s world!\n", farewell)
  return nil
}

func genFarewell(ctx context.Context) (string, error) {
  // simply pass the ctx down
  switch locale, err := locale(ctx); {
  case err != nil:
    return "", err
  case locale == "EN/US":
    return "goodbye", nil
  }
  return "", fmt.Errorf("unsupported locale")
}

func printGreeting(ctx context.Context) error {
  greeting, err := genGreeting(ctx)
  if err != nil {
    return err
  }
  fmt.Printf("%s world!\n", greeting)
  return nil
}

func genGreeting(ctx context.Context) (string, error) {
  // genGreeting wraps its Context with context.WithTimeout.
  ctx, cancel := context.WithTimeout(ctx, 1*time.Second)
  defer cancel()

  switch locale, err := locale(ctx); {
  case err != nil:
    return "", err
  case locale == "EN/US":
    return "hello", nil
  }
  return "", fmt.Errorf("unsupported locale")
}

func locale(ctx context.Context) (string, error) {
  // check to see whether the Context has provided a deadline.
  // If it did, and the system’s clock has advanced past the deadline,
  // simply return with a special error defined in the context package,
  // the `DeadlineExceeded`.
  if deadline, ok := ctx.Deadline(); ok {
    if deadline.Sub(time.Now().Add(15 * time.Second)) <= 0 {
      return "", context.DeadlineExceeded
    }
  }
  select {
  case <-ctx.Done():
    // This line returns the reason why the Context was canceled.
    // This error will bubble all the way up to main,
    // which will cause the cancellation at `main.cancel` function in goroutine
    return "", ctx.Err()
  case <-time.After(15 * time.Second):
  }
  return "EN/US", nil
}
```

</details>

<details>

<summary>

Although the difference in these example program is small, it allows the `locale` function to fail fast. In programs that may have a high cost for calling the next bit of functionality, this may save a significant amount of time, but at the very least it also allows the function to fail immediately instead of having to wait for the actual timeout to occur. The only catch is that you have to have some idea of how long your subordinate call-graph will take

This brings us to the other half of what the `context` package provides: a data-bag for a `Context` to store and retrieve request-scoped data.

</summary>

```go

func main() {
  ProcessRequest("jane", "abc123")
}

func ProcessRequest(userID, authToken string) {
  ctx := context.WithValue(context.Background(), "userID", userID)
  HandleResponse(ctx)
  ctx = context.WithValue(ctx, "authToken", authToken)
  HandleResponse(ctx)
}

func HandleResponse(ctx context.Context) {
  fmt.Printf(
    "handling response for %v (%v)",
    ctx.Value("userID"),
    ctx.Value("authToken"),
  )
}
```

Notice that both the `Context`’s key and value are defined as `interface{}`, we lose Go’s type-safety when attempting to retrieve values.

For these reasons, the Go authors recommend you follow a few rules when storing and retrieving value from a `Context`.

```go
func main() {
  ProcessRequest("jane", "abc123")
}

type ctxKey int

const (
  ctxUserId ctxKey = iota
  ctxAuthToken
)

func UserID(c context.Context) string {
  return c.Value(ctxUserId).(string)
}

func AuthToken(c context.Context) string {
  return c.Value(ctxAuthToken).(string)
}

func ProcessRequest(userID, authToken string) {
  ctx := context.WithValue(context.Background(), ctxUserId, userID)
  ctx = context.WithValue(ctx, ctxAuthToken, authToken)
  HandleResponse(ctx)
}

func HandleResponse(ctx context.Context) {
  fmt.Printf(
    "handling response for %v (%v)",
    UserID(ctx),
    AuthToken(ctx),
  )
}
```

We now have a type-safe way to retrieve values from the `Context`. However, this technique does pose a problem.

In the previous example, let’s say `HandleResponse` did live in another package named `response`, and let’s say the package `ProcessRequest` lived in a package named `process`. The `process` package would have to import the `response` package to make the call to `HandleResponse`, but `HandleResponse` would have no way to access the accessor functions defined in the `process` package because importing `process` would form a circular dependency. Because the types used to store the keys in `Context` are private to the `process` package, the `response` package has no way to retrieve this data!

This coerces the architecture into creating packages centered around data types that are imported from multiple locations. This certainly isn’t a bad thing, but it’s something to be aware of.

</details>
