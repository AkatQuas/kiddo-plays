# Heap Snapshot exercise

> Forked from [node-example-heapdump](https://github.com/naugtur/node-example-heapdump) by [naugtur](https://github.com/naugtur).

## Prepare

You might read some blogs before diving into the exercises.

- [Minimize Heap Allocations in Node.js | AppSignal Blog](https://blog.appsignal.com/2022/09/28/minimize-heap-allocations-in-nodejs.html)

- [JavaScript Memory Model Demystified](https://www.zhenghao.io/posts/javascript-memory)

- [How is data stored in V8 JS engine memory?](https://blog.dashlane.com/how-is-data-stored-in-v8-js-engine-memory/)

Before running the project, please install the dependencies.

```
npm install
```

_Note, some of the dependencies there are pinned to old versions so that they produce the memory leak you are here to find._

## Getting a heap snapshot

- Run `npm run start`
- Open [http://localhost:8080](http://localhost:8080)
- Now try implementing getting a heap snapshot through a http request and prove a leak exists.
  - This could be done without the `heapdump` package, but with [this](https://nodejs.org/dist/latest-v12.x/docs/api/v8.html#v8_v8_writeheapsnapshot_filename)

## Finding a real issue

Now let's look at a real case of a memory leak. Still a pretty naive one, but one that at least looks realistically.

- Run `npm run real`
- Open [http://localhost:8080](http://localhost:8080)
- Get two heap snapshots
- Find the leak, trace it to a properly named object that you can find, locate the code responsible for leaking (or at least the file).

## Spoilers

If you're ready to give up, try again and then look at [spoilers.txt](./spoilers.txt).
