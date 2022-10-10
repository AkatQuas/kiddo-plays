# Byte Code

Run Compiled JavaScript instead of the execution from source code.

As mentioned in this [article](https://v8.dev/blog/code-caching), we might take the advantage of compiled `CacheData` to be able to execute the compiled machine code instead of source code, with the benefits of security and protection.

The project [little-byte](./little-byte) here is, a forked project from [little-byte](https://github.com/Nihiue/little-byte) to have a starter view of code caching.

A better bytecode runner is [bytenode][bytenode].

And be careful about these [known issues](https://github.com/bytenode/bytenode#known-issues-and-limitations) listed in [bytenode][bytenode].

<!-- hidden links  -->

[bytenode]: https://github.com/bytenode/bytenode
