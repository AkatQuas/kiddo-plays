[back to home](./README.md)

# Docker

## Fun facts about images

A Docker image is physically stored as lots of small files, and Docker assembles them together to create the container’s filesystem. When all the layers have been pulled, the full image is available to use.

A Docker image is a logical collection of image layers. Layers are the files that are physically stored in the Docker Engine’s cache. Here’s why that’s important: image layers can be shared between different images and different containers.

If image layers are shared around, they can’t be edited -- otherwise a change in one image would cascade to all the other images that share the changed layer. _Docker enforces that by making image layers read-only_.

In some ways, the image itself is just a configuration file that lists the layers and some metadata.

The layers are where the data lives (files and code etc.). Each layer is fully independent, and has no concept of being part of an overall bigger image.
Each image is identified by a crypto ID that is a hash of the config file. Each layer is identified by a crypto ID that is a hash of the layer content. we call these “content hashes”.

Docker and Docker Hub have a slick way of supporting multi-arch images. This means a single image, such as golang:latest, can have an image for Linux on x64, Linux on PowerPC, Windows x64, Linux on different versions of ARM, and more. To make this happen, the Registry API supports two important constructs: **manifestlists**, **manifests**. The manifest list is exactly what it sounds like: a list of architectures supported by a particular image tag. Each supported architecture then has its own manifest detailing the layers that make it up.

```bash
docker manifest inspect IMAGE

docker manifest inspect IMAGE | grep 'architecture\|os'
```

### Images - The commands

- `docker image pull` is the command to download images. We pull images from repositories inside of remote registries. By default, images will be pulled from repositories on Docker Hub. This command will pull the image tagged as latest from the alpine repository on Docker Hub: `docker image pull alpine:latest`.

- `docker image ls` lists all of the images stored in your Docker host’s local image cache. To see the SHA256 digests of images add the `--digests` flag.

- `docker image inspect` is a thing of beauty! It gives you all of the glorious details of an image — layer data and metadata.

- `docker manifest inspect` allows you to inspect the manifest list of any image stored on Docker Hub. This will show the manifest list for the redis image: `docker manifest inspect redis`.

- `docker buildx` is a Docker CLI plugin that extends the Docker CLI to support multi-arch builds.

- `docker image rm` is the command to delete images. This command shows how to delete the alpine:latest image — `docker image rm alpine:latest`. You cannot delete an image that is associated with a container in the running (Up) or stopped (Exited) states.

```bash
# delete all images
docker image rm $(docker image ls -q) -f
```

## Fun facts about containers

Containers are running only while the application inside the container is running. As soon as the application process ends, the container goes into the exited state. Exited containers don’t use any CPU time or memory. The interactive container we were connected to exited as soon as we exited the terminal application.

> Container exits when the main process in it exits.

Containers don’t disappear when they exit. Containers in the exited state still exist, which means you can start them again, check the logs, and copy files to and from the container’s filesystem. You only see running containers with `docker container ls`, but Docker doesn’t remove exited containers unless you explicitly tell it to do so. Exited containers still take up space on disk because their filesystem is kept on the computer’s disk.

Stopping a container does not destroy the container or the data inside of it.

`docker container stop` sends a _SIGTERM_ signal to the main application process inside the container. This gives the process a chance to clean things up and gracefully shut itself down. If it doesn't exit within 10 seconds, it will receive a _SIGKILL_.

`docker container rm <container> -f` only send _SIGKILL_ signal.

```bash
# delete all containers
docker container rm $(docker container ls -aq) -f
```

## Containerizing an app

The process of taking an application and configuring it to run as a container is called “containerizing”.

Containers are all about making apps simple to _build_, _ship_, and _run_. The process of containerizing an app looks like this:

1. Start with the application code and dependencies.

1. Create a _Dockerfile_ that describes the app, its dependencies, and how to run it.

1. Feed the _Dockerfile_ into the `docker image build` command.

1. Push the new image to a registry (optional)

1. Run container from the image

## Fun facts about Dockerfile

Comment lines start with the `#` character.

All non-comment lines are **Instructions** and take the format INSTRUCTION argument. Instruction names are not case sensitive, but it’s normal practice to write them in UPPERCASE. This makes reading the Dockerfile easier.

Some instructions create new layers, whereas others just add metadata to the image config file.

```bash
# show the build history
docker image history IMAGE
```

A common example is that every `RUN` instruction adds a new layer. As a result, it’s usually considered a best practice to include multiple commands as part of a single `RUN` instruction — all glued together with double-ampersands (&&) and backslash (\) line-breaks. While this isn’t rocket science, it requires time and discipline.

This is called a _multi-stage_ Dockerfile, because there are several stages to the build. Each stage starts with a `FROM` instruction, and you can optionally give stages a name with the AS parameter. Although there are multiple stages, the output will be a single Docker image with the contents of the _final stage_.

Each stage runs independently, but you can copy files and directories from previous stages.

The `RUN` instruction executes a command inside a container during the build, and any output from that command is saved in the image layer. You can execute anything in a `RUN` instruction, but the commands you want to run need to exist in the Docker image.

multi-stage mechanism provide us with:

- **standardization**: this hugely simplifies on-boarding for new developers, eliminates the maintenance burden for build servers, and removes the potential for breakages where users have different versions of tools.

- **performance**: Each stage in a multi-stage build has its own cache. Docker looks for a match in the image layer cache for each instruction; if it doesn’t find one, the cache is broken and all the rest of the instructions are executed -- but only for that stage. The next stage starts again from the cache.

- **lightness**: it helps to fine-tune your build so the final application image is as lean as possible. Any tooling you need can be isolated in earlier stages, so the tool itself isn’t present in the final image.

<details>
<summary>
Specifying image labels ond build arguments in the Dockerfile
</summary>

The `LABEL` instruction just applies the key/value pair from the Dockerfile to the image when it gets built.

`ARG` is very similar to the `ENV` instruction, except that it works at build time on the image, rather than at run time in the container. They both set the value of an environment variable, but for `ARG` instructions that setting only exists for the duration of the build, so any containers you run from the image don’t see that variable.

```Dockerfile
# ...
ARG BUILD_NUMER=0
ARG BUILD_TAG=local

LABEL version="3.0"
LABEL build_number=${BUILD_NUMBER}
LABEL build_tag=${BUILD_TAG}
# ...
```

</details>

<details>

<summary>
Any Dockerfile you write should be optimized so that the instructions are ordered by how frequently they change -- with instructions that are unlikely to change at the start of the Dockerfile, and instructions most likely to change at the end.
</summary>

```Dockerfile
FROM diamol/node

ENV TARGET="blog.sixeyed.com"
ENV METHOD="HEAD"
ENV INTERVAL="3000"

WORKDIR /web-ping
COPY app.js ./

CMD ["node", "/web-ping/app.js"]
```

The above docker would generate 7 layers, and when the `app.js` file change, the last layer also will rebuild even though its content doesn't change.

The following docker has 5 layers, and the only the last layer would rebuild when the `app.js` is modified.

```Dockerfile
FROM diamol/node

CMD ["node", "/web-ping/app.js"]

ENV TARGET="blog.sixeyed.com" \
    METHOD="HEAD" \
    INTERVAL="3000"

WORKDIR /web-ping
COPY app.js .
```

</details>

### Squashing

Squashing can be good in situations where images are starting to have a lot of layers and this isn’t ideal. An example might be when creating a new base image that you want to build other images from in the future — this base is much better as a single-layer image.

On the negative side, squashed images do not share image layers. This can result in storage inefficiencies and larger push and pull operations.

Add the `--squash` flag to the `docker image build` command if you want to create a squashed image.

### Use no-install-recommends

If you are building Linux images, and using the apt package manager, you should use the `no-install-recommends` flag with the `apt-get install` command. This makes sure that apt only installs main dependencies (packages in the Depends field) and not recommended or suggested packages. This can greatly reduce the number of unwanted packages that are downloaded into your images.

## How Docker runs containers

- The Docker Engine is the management component of Docker. It looks after the local image cache, downloading images when you need them, and reusing them if they’re already downloaded. It also works with the operating system to create containers, virtual networks, and all the other Docker resources. The Engine is a background process that is always running.

- The Docker Engine makes all the features available through the Docker API, which is just a standard HTTP-based REST API. You can configure the Engine to make the API accessible only from the local computer (which is the default), or make it available to other remote computers on your network.

- The Docker command-line interface (CLI) is a client of the Docker API. When you run Docker commands, the CLI actually sends them to the Docker API, and the Docker Engine does the work.

The Docker Engine uses a component called `containerd` to actually manage containers, and containerd in turn makes use of operating system features to create the virtual environment that is the container.

> Internally, the daemon instructed `containerd` and `runc` to create and start the container.

Restart policies are applied per-container, and can be configured imperatively on the command line as part of `docker-container run` commands, or declaratively in YAML files for use with higher-level tools such as Docker Swarm, Docker Compose, and Kubernetes.

There are three kinds of restart policies:

- always
- unless-stopped
- on-failed

The _always_ policy is the simplest. It always restarts a stopped container unless it has been explicitly stopped, such as via a `docker container stop` command.

> An interesting feature of the `--restart always` policy is that if you stop a container with `docker container stop` and the restart the Docker daemon, the container will be restarted. To be clear... you start a new container with the `--restart always` policy and then stop it with the docker container stop command. At this point the container is in the Stopped (Exited) state. However, if you restart the Docker daemon, the container will be automatically restarted when the daemon comes back up. You need to be aware of this.

The main difference between the _always_ and _unless-stopped_ policies is that containers with the `--restart unless-stopped` policy will _not be restarted_ when the daemon restarts if they were in the Stopped (Exited) state.

The _on-failure_ policy will restart a container if it exits with a non-zero exit code. It will also restart containers when the Docker daemon restarts, even containers that were in the stopped state.

Publishing ports needs a little more explanation. When you install Docker, it injects itself into your computer’s networking layer. Traffic coming into your computer can be intercepted by Docker, and then Docker can send that traffic into a container.
