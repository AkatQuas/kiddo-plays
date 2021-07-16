# Custom Renderer

Check out the [react-reconciler](https://github.com/facebook/react/tree/main/packages/react-reconciler).

Check out this [video](https://www.youtube.com/watch?v=oPofnLZZTwQ).

Check out these three articles: [part 1](https://blog.atulr.com/react-custom-renderer-1/), [part 2](https://blog.atulr.com/react-custom-renderer-2/), [part 3](https://blog.atulr.com/react-custom-renderer-1/).

> Every platform renderer, be it dom, react native, etc has to have its own configuration called **hostConfig** along with the `react-reconciler`.
>
> Renderers are required to implement all the necessary platform specfic functions inside the **hostConfig**.
>
> The `react-reconciler` module inside the renderer will call the platform specific functions via the supplied hostConfig to perform dom changes or view updates.

Here is a workable implementation of [custom renderer](./fiber-renderer).
