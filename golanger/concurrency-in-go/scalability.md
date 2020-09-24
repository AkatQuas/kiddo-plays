# Concurrency at Scale

Scaling concurrent operations within a single process.

Finding out how concurrency comes into play when dealing with more than one process.

## Error Propagation

With concurrent code, and especially distributed systems, it’s both easy for something to go wrong in your system, and difficult to understand why it happened.

Let’s spend some time here discussing a philosophy of error propagation. What follows is an opinionated framework for handling errors in concurrent systems.

Errors indicate that your system has entered a state in which it cannot fulfill an operation. Because of this, it needs to relay a few pieces of critical information:

- What happended:

  This is the part of the error that contains information about what happened. This information is likely to be generated implicitly by whatever it was that generated the errors, although you can probably decorate this with some context that will help the user.

- When and where it occurred:

  Errors should always contain a complete stack trace starting with how the call was initiated and ending with where the error was instantiated. The stack trace should not be contained in the error message, but should be easily accessible when handling the error up the stack.

  Further, the error should contain information regarding the context it’s running within, as well as the time on the machine the error was instantiated on, in UTC.

- A friendly user-facing message, optional.

  The message that gets displayed to the user should be customized to suit your system and its users. It should only contain abbreviated and relevant information from the previous two points.

- How the user can get more information, optional.

  At some point, someone will likely want to know, in detail, what happened when the error occurred. Errors that are presented to users should provide an ID that can be cross-referenced to a corresponding log that displays the full information of the error: time the error occurred (not the time the error was logged), the stack trace. It can also be helpful to include a hash of the stack trace to aid in aggregating like issues in bug trackers.

It’s possible to place all errors into one of two categories:

- Bugs

- Known edge cases (e.g., broken network connections, failed disk writes, etc.)

Bugs are errors that the program have not customized to the system, or _raw errors_. Imagine a large system with multiple modules:

```
  CLI Component --> Intermediary Component --> Low Level Component
```

At boundaries of each component, all incomming errors must be wrapeed in a well-formed error for the component code is within. Sometimes we need to wrap error to be malformed.

```go
func PostReport(id string) error {
  result, err := lowlevel.DoWork()
  if err != nil {
    if _, ok := err.(lowlevel.Error); ok {
      err = WrapErr(err, "cannot post report with id %q", id)
    }
    return err
  }
}

type MyError struct {
  Inner error
  Message string
  StackTrace string
  Misc map[string]interface{}
}

func wrapError(err error, messagef string, msgArgs ...interface{}) MyError {
  return MyError{
    Inner: err,
    Message: fmt.Sprintf(messagef, msgArs...),
    StackTrace: string(debug.Stack()),
    Misc: make(map[string]interface{}),
  }
}

func (err MyError) Error() string {
  return err.Message
}

type LowLevelErr struct {
  error
}

func isGloballyExec(path string) (bool, error) {
  info, err := os.Stat(path)
  if err != nil {
    return false, LowLevelErr{wrapError(err, err.Error())}
  }
  return info.Mode().Perm()&0100 = 0100, nil
}

type IntermediateErr struct {
  error
}
```

Note that it is only necessary to wrap errors in the module boundaries, such as public functions/methods, or when the code can add valuable context.

As we logging these errors with much information, we should display a friendly message to the user stating something unexpected has happened.

## Timeouts and Cancellation

Timeouts are crucial to creating a system with behavior you can understand. Cancellation is one natural response to a timeout.

Here are some reasons we might want the concurrent processes to support timeouts:

- System saturation

  If the system is saturated, it may want the requests at the edges of the system to time out rather than take a long time to field them.

- Stale data

  Sometimes data has a window within which it must be processed before more relevant data is available, or the need to process the data has expired. If a concurrent process takes longer to process the data than this window, we would want to time out and cancel the concurrent process.

  If this window is known beforehand, it would make sense to pass our concurrent process a `context.Context` created with `context.WithDeadline`, or `context.WithTimeout`. If the window is not known beforehand, the parent of the concurrent process could use `context.WithCancel` to be able to cancel the concurrent process when there's no more need for the request.

- Attempting to prevent deadlocks

  In a large system—especially distributed systems—it can sometimes be difficult to understand the way in which data might flow, or what edge cases might turn up. It is not unreasonable, and even recommended, to place timeouts on all of your concurrent operations to guarantee your system won’t deadlock. The timeout period doesn’t have to be close to the actual time it takes to perform your concurrent operation. The timeout period’s purpose is only to prevent deadlock, choose a reasonable time duration.

Here are a number of reasons why a concurrent process might be canceled:

- Timeouts

  A timeout is an implicit cancellation.

- User intervention

  It's usually advisable to start long-running processes concurrently and then report status back to the user at a polling interval, or allow the users to query for status as they see fit. So it is necessary to allow the users to cancel the operation they've started.

- Parent cancellation

  For that matter, if any kind of parent of a concurrent operation stops, as a child of that parent, it should be canceled.

- Replicated Requests

  Sometimes, we may send data to multiple concurrent processes in an attempt to get a faster response from one of them. When the first one comes back, we would want to cancel the rest of the processes.

To reify cancellation, we need to explore the preemptability of a concurrent process.

```go
val value interface{}
select {
case <-done:
  return
case value = <-valueStream:
}

result := reallyLongCalculation(value)

select {
case <-done:
  return
case valueStream<-result:
}

// reallyLongCalculation is preemptable
reallyLongCalculation := func(
  done <-chan interface{},
  value interface{},
) interface{} {
  intermediateResult := longCalculation(done, value)
  return logCalculation(done, intermediateResult)
}
```

Using cancellation lurking another problem: if the goroutine happens to modify shared state what happens when the goroutine is canceled? Does the goroutine try and roll back the intermediary work it’s done? How long does it have to do this work? Something has told the goroutine that it should halt, so the goroutine shouldn’t take too long to roll back its work, right?

Backing out or rolling back may be required after a cancellation.

Another issue is duplicated message/result. Both the parent and the child can take their own strategy to response the duplicated result:

- The child accept either the first or the last result

- The child poll the parent for permission to deal with result

## Heartbeats

Heartbeats are a way for concurrent processes to signal life to outside parties. There are two different types of heartbeats discussed below:

- Heartbeats that occur on a time interval

- Heartbeats that occur at the beginning of a unit of work

Heartbeats that occur on a time interval are useful for concurrent code that might be waiting for something else to happen for it to process a unit of work. A heartbeat is a way to signal to its listeners that everything is well, and that the silence is expected.

<details>

<summary>

The following code demostrates a goroutine that exposes a heartbeat:

</summary>

```go
doWork := func(
  done <-chan interface{},
  pulseInterval time.Duration,
) (<-chan interface{}, <-chan item.Time) {
  // set up a channel to send heartbeats on,
  // return this out of doWork
  heartbeat := make(chan interface{})
  results := make(chan time.Time)
  go func() {
    defer close(heartbeat)
    defer close(results)

    pulse := time.Tick(pulseInterval)
    workGen := time.Tick(2 * pulseInterval)

    sendPulse := func() {
      select {
      case heartbeat <-struct{}{}:
      default:
        // guard against the fact no one may be
        // listening to the heartbeat
      }
    }
    sendResult := func(r time.Time) {
      for {
        select {
        case <-done:
          return
        case <-pulse:
          // just like with `done` channel
          // anytime performing a send or receive,
          // a case for the heartbeat's pulse is needed
          sendPulse()
        case results <- r:
          return
        }
      }
    }

    for {
      select {
      case <-done:
        return
      case <-pulse:
        // just like with `done` channel
        // anytime performing a send or receive,
        // a case for the heartbeat's pulse is needed
        sendPulse()
      case r := <-workGen:
        sendResult(r)
      }
    }
  }()
  return heartbeat, results
}

// set up the standard `done` channel
done := make(chan interface{})
// close the `done` channel after 10 seconds
time.AfterFunc(10 * time.Second, func() { close(done) })

const timeout = 2 * time.Second
heartbeat, results := doWork(done, timeout / 2)
for {
  select {
  case _, ok := <-heartbeat:
    // select on the heartbeat, if there is no result,
    // at least guaranteed a message from the heartbeat channel
    if ok == false {
      return
    }
    fmt.Println("pulse")
  case r, ok := <-results:
    // select from the results channel
    if ok == false {
      return
    }
    fmt.Printf("results %v\n", r.Second())
  case <-time.After(timeout):
    // here we timeout if we haven't
    // received either a heartbeat or a new result
    return
  }
}
```

By using a heartbeat, we have successfully avoided a deadlock, and we remain deterministic by not having to rely on a longer timeout.

```go
doWork := func(
  done <-chan interface{},
  pulseInterval time.Duration,
) (<-chan interface{}, <-chan item.Time) {
  heartbeat := make(chan interface{})
  results := make(chan time.Time)
  go func() {
    // do not close either channel
    // after the end of this goroutine
    pulse := time.Tick(pulseInterval)
    workGen := time.Tick(2 * pulseInterval)

    sendPulse := func() {
      select {
      case heartbeat <-struct{}{}:
      default:
      }
    }
    sendResult := func(r time.Time) {
      for {
        select {
        case <-done:
          return
        case <-pulse:
          sendPulse()
        case results <- r:
          return
        }
      }
    }
    // simulate a panic here,
    // only loop twice
    for i := 0; i < 2; i++ {
      select {
      case <-done:
        return
      case <-pulse:
        sendPulse()
      case r := <-workGen:
        sendResult(r)
      }
    }
  }()
  return heartbeat, results
}

done := make(chan interface{})
time.AfterFunc(10 * time.Second, func() { close(done) })

const timeout = 2 * time.Second
heartbeat, results := doWork(done, timeout / 2)
for {
  select {
  case _, ok := <-heartbeat:
    if ok == false {
      return
    }
    fmt.Println("pulse")
  case r, ok := <-results:
    if ok == false {
      return
    }
    fmt.Printf("results %v\n", r.Second())
  case <-time.After(timeout):
    // rely on a longer timeout
    fmt.Println("worker goroutine is not healthy")
    return
  }
}
```

</details>

<details>

<summary>

Also, heartbeats can occur at the beginning of a unit of work. These are extremely useful for tests.

</summary>

```go
doWork := func(done <-chan interface{}) (<-chan interface{}, <-chan int) {
  // create the heartbeat channel with a buffer of one.
  // this ensures that there's always at least one pulse sent
  // out even if no one is listening in time for the send to occur
  heartbeatStream := make(chan interface{}, 1)
  workStream := make(chan int)
  go func() {
    defer close(heartbeatStream)
    defer close(workStream)

    for i := 0; i < 10; i++ {
      // set up a separate select block for the heartbeat
      select {
      case heartbeatStream <- struct{}{}:
        // we don't include this in the same select block as
        // the send on results because if the receiver isn't
        // ready for the result, they'll receive a pulse instead
        // and the current value of the result will be lost
      default:
        // guard against the fact that no one may be lisitening
        // to the heartbeats.
        // the heartbeats is created with a buffer of one, if
        // someone is listening, but not in time for the first pulse,
        // it will still be notified of a pulse
      }

      select {
      case <-done:
        return
      case workStream <- rand.Intn(10):
      }
    }
  }
  return heartbeatStream, workStream
}

done := make(chan interface{})
defer close(done)

heartbeat, results := doWork(done)
for {
  select {
  case _, ok := <-heartbeat:
    if ok {
      fmt.Println("pulse")
    } else {
      return
    }
  case r, ok := <-results:
    if ok {
      fmt.Printf("results %v\n", r)
    } else {
      return
    }
  }
}
```

</details>

<details>

<summary>

Where this technique really shines is in writing tests. Interval-based heartbeats can be used in the same fashion, but if you only care that the goroutine has started doing its work, this style of heartbeat is simple.

</summary>

```go
func DoWork(
  done <-chan interface{},
  nums ...int,
) (<-chan interface{}, <-chan int) {
  heartbeat := make(chan interface{}, 1)
  intStream := make(chan int)
  go func() {
    defer close(heartbeat)
    defer close(intStream)
    // simulate some kind of delay before
    // the goroutine can begin working
    time.Sleep(2 * time.Second)

    for _, n := range nums {
      select {
      case heartbeat <- struct{}{}:
      default:
      }

      select {
      case <-done:
        return
      case intStream <-n:
      }
    }
  }()

  return heartbeat, intStream
}

/*
  This test is bad because it's nondeterministic.
  We cannot guaranteed that the first iteration of the goroutine
  will occur before the timeout
*/
func TestDoWork_GeneratesAllNumbers(t *testing.T) {
  done := make(chan interface{})
  defer close(done)

  intSlice := []int{0, 1, 3, 2, 5}
  _, results := DoWork(done, intSlice...)

  for i, expected := range intSlice {
    select {
    case r := <-results:
      if r != expected {
        t.Errorf(
          "index %v: expected %v, but received %v,"
          i,
          expected,
          r,
        )
      }
    case <-time.After(1 * time.Second):
      t.Fatal("test timed out")
    }
  }
}

/*
  Using heartbeat, we can solve this problem
  Here is a good and deterministic test.
  The only risk is one of the iterations taking an
  inordinate amount of time.
*/
func TestDoWork_GenerateAllNumbers(t *testing.T) {
  done := make(chan interface{})
  defer close(done)

  intSlice := []int{0, 1, 3, 2, 5}
  heartbeat, results := DoWork(done, intSlice...)

  // we wait for the goroutine to signal that
  // it's beginning to process an iteration, aka results working
  <-heartbeat

  i := 0
  for r := range results {
    if expected := intSlice[i]; r != expected {
      t.Errorf(
        "index %v: expected %v, but received %v",
        i,
        expected,
        r,
      )
    }
    i++
  }
}

```

</details>

## Replicated Requests

If this replication is done in-memory, it might not be that costly, but if replicating the handlers requires replicating processes, servers, or even data centers, this can become quite costly.

```go
doWork := func(
  done <-chan interface{},
  id int,
  wg *sync.WaitGroup,
  result chan<-int,
) {
  started := time.Now()
  defer wg.Done()

  simulatedLoadTime := time.Duration(1+rand.Intn(5)) * time.Second
  fmt.Printf("%v would take %v\n", id, simulatedLoadTime)
  select {
  case <-done:
  case <-time.After(simulatedLoadTime):
  }

  select {
  case <-done:
  case result<-id:
  }

  took := time.Since(started)
  // Display how long handlers would have taken
  if took < simulatedLoadTime {
    took = simulatedLoadTime
  }
  fmt.Printf("%v took %v\n", id, took)
}

done := make(chan interface{})
result := make(chan int)

var wg sync.WaitGroup
wg.Add(10)

for i := 0; i < 10; i++ {
  go doWork(done, i, &wg, result)
}

firstReturned := <-result
// cancel the remaining handlers
close(done)
wg.Wait()
fmt.Printf("Received an answer from #%v\n", firstReturned)
```

The only caveat to this approach is that all of the handlers need to have equal opportunity to service the request. In other words, the program is not going to have a chance at receiving the fastest time from a handler that can’t service the request. Whatever resources the handlers are using to do their job need to be replicated as well.

## Rate Limiting

Rate limiting constrains the number of times some kind of resource is accessed to some finite number per unit of time.

Rate limiting allow you to reason about the performance and stability of your system by preventing it from falling outside the boundaries.

In scenarios where you're charing for access to your system, rate limits can maintain a healthy realtionship with your clients. You can allow them to try the system out under heavily constrained rate limits.

Most rate limiting is done by utilizing an algorithm called the _token bucket_.

Assuming it to utilize a resource, the program has to have an _access token_ for the resource. Without an token, the request is denied. Now imagine these tokens are stored in a bucket, which has a finite capacity `d`, waiting to be retrieved for usage. Now everytime you need to access the resource, the program reach into the bucket and remove a token, and never put it back. So when there's no token available, the program could either have to queue the request until a token becomes available, or just deny the request.

In order to replenishing the tokens, we could define `r` to be the rate at which tokens are _added back_ to the bucket. This becomes what we commonly think of as the rate limit.

The capacity `d` and the replenishing rate `r` help us to control both the _burstiness_ and overall rate limit. Burstiness simply means how many requests can be made when the buckets is full.

<details>

<summary>

There's an official implementation of a bucket token rate limit algorithm which is located in `golang.org/x/time/rate` package.

</summary>

```go
/* helper functions */
func Per(eventCount int, duration time.Duration) rate.Limit {
  return rate.Every(duration/time.Duration(eventCount))
}


func Open() *APIConnection {
  return &APIConnection{
    // set the rate limit for all API connections
    // to one event per second
    rateLimiter: rate.NewLimiter(rate.Limit(1), 1),
  }
}

type APIConnection struct {
  rateLimiter *rate.Limiter
}

func (a *APIConnection) ReadFile(ctx context.Context) error {
  // wait on the rate limiter to have enough
  // access tokens to complete our request
  if err := a.rateLimiter.Wait(ctx); err != nil {
    return err
  }
  // pass
  return nil
}

func (a *APIConnection) ResolveAddress(ctx context.Context) error {
  // wait on the rate limiter to have enough
  // access tokens to complete our request
  if err := a.rateLimiter.Wait(ctx); err != nil {
    return err
  }
  // pass
  return nil
}

func main() {
  defer log.Printf("Done.")

  log.SetOutput(os.Stdout)
  log.SetFlags(log.Ltime | log.LUTC)

  apiConnection := Open()

  var wg sync.WaitGroup
  wg.Add(20)

  for i := 0; i < 10; i++ {
    go func() {
      defer wg.Done()
      err := apiConnection.ReadFile(context.Background())
      if err != nil {
        log.Printf("cannot ReadFile: %v", err)
        return
      }
      log.Printf("ReadFile")
    }()
  }

  for i := 0; i < 10; i++ {
    go func() {
      defer wg.Done()
      err := apiConnection.ResolveAddress(context.Background())
      if err != nil {
        log.Printf("cannot ResolveAddress: %v", err)
        return
      }
      log.Printf("ResolveAddress")
    }()
  }

  wg.Wait()
}
```

Sometimes instead of attempting to roll the semantics of limits per unit of time into a single layer, the program could keep the limiters separate and then combine them into one rate limiter that mangaes the iteraction.

```go
// define a RateLimiter interface so that
// a MultiLimiter can recursively define other
// MultiLimiter instances
type RateLimiter interface {
  Wait(context.Context) error
  Limit() rate.Limit
}

func MultiLimiter(limiters ...RateLimiter) *multiLimiter {
  byLimit := func(i, j int) bool {
    return limiters[i].Limit() < limiters[j].Limit()
  }

  // implement an optimization and
  // sort by the Limit() of each RateLimiter
  sort.Slice(limiters, byLimit)
  return &multiLimiter{limiters: limiters}
}

type multiLimiter struct {
  limiters []RateLimiter
}

func (l *multiLimiter) Wait(ctx context.Context) error {
  for _, l := range l.limiters {
    if err := l.Wait(ctx); err != nil {
      return err
    }
  }
  return nil
}

func (l *multiLimiter) Limit() rate.Limit {
  // the multiLimiter is sorted
  // so simply return the most restrictive limit
  return l.limiters[0].Limit()
}
```

The `Wait` method loops through all the child rate limiters and calls `Wait` on each of them. These calls may or may not block, but we need to notify each rate limiter of the request so we can decrement our token bucket. By waiting for each limiter, we are guaranteed to wait for exactly the time of the longest wait. This is because if we perform smaller waits that only wait for segments of the longest wait and then hit the longest wait, the longest wait will be recalculated to only be the remaining time. This is because while the earlier waits were blocking, the latter waits were refilling their buckets; any waits after will be returned instantaneously.

Modify the `APIConnection`:

```go
func Open() *APIConnection {
  // define the limit per second with no burstiness
  // the limit per second will ensure the system
  // won't overload with request
  secondLimit := rate.NewLimiter(Per(2, time.Second), 1)

  // define the limit per minute with a burstiness of 10
  // to give the users their initial pool.
  minuteLimit := rate.NewLimiter(Per(10, time.Minute), 10)

  return &APIConnection{
    // combine the two limits and set this as
    // the master rate limiter for APIConnection
    rateLimiter: MultiLimiter(secondLimit, minuteLimit),
  }
}

type APIConnection struct {
  rateLimiter RateLimiter
}

func (a *APIConnection) ReadFile(ctx context.Context) error {
  if err := a.rateLimiter.Wait(ctx); err != nil {
    return err
  }
  // pass
  return nil
}

func (a *APIConnection) ResolveAddress(ctx context.Context) error {
  if err := a.rateLimiter.Wait(ctx); err != nil {
    return err
  }
  // pass
  return nil
}
```

Defining limits like this allows us to express our coarse-grained limits plainly while still limiting the number of requests at a finer level of detail.

This technique also allows us to begin thinking across dimensions other than time. When you rate limit a system, you’ll likely have some kind of limit on the number of API requests, but in addition, you’ll probably also have limits on other resources like disk access, network access, etc. Let’s flesh out our example a bit and set up rate limits for disk and network:

```go
func Open() *APIConnection {
  return &APIConnection{
    // set up a combined rate limiter for API calls,
    // there are limits for both requests per second, and requests per minute
    apiLimit: MultiLimiter(
      rate.NewLimiter(Per(2, time.Second), 2),
      rate.NewLimiter(Per(10, time.Minute), 10),
    ),
    // a rate limit for disk reads.
    // only limit this to one read per second
    diskLimit: MultiLimiter(
      rate.NewLimiter(rate.Limit(1), 1),
    ),
    // a rate limit for disk reads.
    // limit this to three read per second
    apiLimit: MultiLimiter(
      rate.NewLimiter(Per(3, time.Second), 3),
    ),
  }
}

type APIConnection struct {
  networkLimit,
  diskLimit,
  apiLimit RateLimiter
}

func (a *APIConnection) ReadFile(ctx context.Context) error {
  // when read a file, combine the limits
  err := MultiLimiter(a.apiLimit, a.diskLimit).Wait(ctx);
  if err != nil {
    return err
  }
  // pass
  return nil
}

func (a *APIConnection) ResolveAddress(ctx context.Context) error {
  // when read a file, combine the limits
  err := MultiLimiter(a.apiLimit, a.networkLimit).Wait(ctx);
  if err != nil {
    return err
  }
  // pass
  return nil
}
```

</details>

## Healing Unhealthy Goroutines

Some goroutine may fall into a bad state from which itself cannot recover without external help.

To heal goroutines, the program could use the heartbeat pattern to check up on the liveliness of the goroutine. The type of heartbeat will be determined by what the program is trying to monitor, but if the goroutine can become livelocked, make sure that the heartbeat contains some kind of information indicating that the goroutine is not only up, but doing useful work.

The logic that monitors a goroutine's health is called _steward_, the monited goroutine is called _ward_. Stewards will also be responsible for restarting a ward's goroutine should it become unhealthy.

```go
// define the signature of a goroutine that
// can be monitored and restarted.
type startGoroutineFn func(
  done <-chan interface{},
  pulseInterval time.Duration,
) (heartbeat <-chan interface{})

// a steward takes in a `timeout`,
// `startGoroutine` will start the to-be-monitored goroutine,
// the steward itself is also monitorable
newSteward := func(
  timeout time.Duration,
  startGoroutine startGoroutineFn,
) startGoroutineFn {
  return func(
    done <-chan interface{},
    pulseInterval time.Duration,
  ) (<-chan interface{}) {
    heartbeat := make(chan interface{})
    go func() {
      defer close(heartbeat)

      var wardDone chan interface{}
      var wardHeartbeat <-chan interface{}
      // a closure that encodes a consistent way
      // to start the goroutine parent monitoring
      startWard := func() {
        // create a new channel passed into the ward goroutine
        // incase we need to signal that it should halt
        wardDone = make(chan interface{})

        // start the goroutine
        wardHeartbeat = startGoroutine(or(wardDone, done), timeout/2)
      }
      startWard()
      pulse := time.Tick(pulseInterval)

  monitorLoop:
      for {
        timeoutSignal := time.After(timeout)

        for {
          // inner loop which ensures the steward
          // can send  out pulses of its own
          select {
          case <-pulse:
            select {
            case heartbeat <- struct{}{}:
            default:
            }
          case <-wardHeartbeat:
            // continue the monitoring loop when
            // receiving the ward's pulse
            continue monitorLoop
          case <-timeoutSignal:
            // no pulse received from the ward within the timeout period
            // request the ward halt and start a new ward goroutine
            log.Println("steward: ward unhealyth; restarting")
            close(wardDone)
            startWard()
            continue monitorLoop
          case <-done:
            return
          }
        }
      }
    }()
    return heartbeat
  }
}

log.SetOutput(os.Stdout)
log.SetFlags(log.Ltime | log.LUTC)

doWork := func(done <-chan interface{}, _ time.Duration) <-chan interface{} {
  log.Println("ward: hello, irresponsible!")
  go func() {
    // this goroutine isn't doing anything
    // and doesn't sending out any pulses
    <-done
    log.Println("ward: halt")
  }()
  return nil
}

// create a function that will create a steward
// for the goroutine `doWork` starts
doWorkWithSteward := newSteward(4 * time.Second, doWork)

done := make(chan interface{})
// halt the steward and its ward after 9 seconds
time.AfterFunc(9 * time.Second, func() {
  log.Println("main: halt steward and ward")
  close(done)
})

// start the steward and range over its pulses
// to prevent the code from halting
for range doWorkWithSteward(done, 4 * time.Second) {}
log.Println("main done")
```

<details>

<summary>

Create a ward that will generate an integer stream based on a discrete list of values:

</summary>

```go
// take in the values and return any channels
// the ward will be using to communicate back on
doWorkFn := func(
  done <-chan interface{},
  intList ...int,
) (startGoroutineFn, <-chan interface{}) {
  // create channel of channels as part of the bridge pattern
  intChanStream := make(chan (<-chan interface{}))
  intStream := bridge(done, intChanStream)
  // create a closuer that will be started
  // and mointored by the steward
  doWork := func(
    done <-chan interface{},
    pulseInterval time.Duration,
  ) <-chan interface{} {
    // instantiate the channel to communicate on
    // within this instance of the ward's goroutine
    intStream := make(chan interface{})
    heartbeat := make(chan interface{})
    go func() {
      defer close(intStream)
      select {
      case intChanStream <- intStream:
        // let the bridge know about the new channel
        // the programm will be communicating on
      case <-done:
        return
      }

      pulse := time.Tick(pulseInterval)

      for {
        valueLoop:
        for _, intVal := range intList {
          if intVal < 0 {
            // simulate an unhealyth ward by
            // logging error and return from goroutine
            log.Printf("negative value: %v\n", intVal)
            return
          }
          for {
            select {
            case <-pulse:
              select {
              case heartbeat <- struct{}{}:
              default:
              }
            case intStream <- intVal:
              continue valueLoop
            case <-done:
              return
            }
          }
        }
      }
    }()
    return heartbeat
  }
  return doWork, intStream
}

log.SetFlags(log.Ltime | log.LUTC)
log.SetOutput(os.Stdout)

done := make(chan interface{})
defer close(done)
// create the ward function, allowing it to
// close over the silce of integers,
// and return a stream that it will communicate back on
doWork, intStream := doWorkFn(done, 1, 2, 3, -1, 4, 5)

// create the steward function, monitoring doWork goroutine
// we expect the failures fairly quickly,
// set the period at just one millisecond
doWorkWithSteward := newSteward(1*time.Millisecond, doWork)
doWorkWithSteward(done, 1*time.Hour)

// use one of the pipeline stages, take the first six values from the intStream
for intVal := range take(done, intStream, 6) {
  fmt.Printf("Received: %v\n", intVal)
}
```

</details>

Without the benefit of a language designed around concurrency, these patterns would likely be much more cumbersome, and much less robust.
