# A simple scheduler

> A simple scheduler run in JavaScript Single Thread.

A scheduler should contain several main features:

1. Add task to job stack, and set the scheduler to active, ready for consume the task.

1. Flush the job stack, pick the job one by one and execute it as long as the condition is a go.

So in order to not block the main JavaScript thread, it's recommended to use `Promise` or microtasks.

[Here](./scheduler.ts) is a complete example code.
