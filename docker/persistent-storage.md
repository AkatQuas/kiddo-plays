[back to home](./README.md)

## Persistent storage

Containers are a perfect runtime for stateless applications. But not all parts of your app will be stateless. There will be components that use disks to improve performance or for permanent data storage.

Each container has its own filesystem, independent of other containers. You can run multiple containers from the same Docker image, and they will all start with the same disk contents. The application can alter files in one container, and that won’t affect the files in other containers -- or in the image.

> Stopping a container doesn’t automatically remove it, so a stopped container’s filesystem does still exist. It's deleted by Docker only when the container is removed.

Containers are designed to be immutable. This is just a buzzword that means read-only —- it’s a best practice not to change the configuration of a container after it’s deployed. If something breaks or you need to change something, you should create a new container with the fixes/updates and deploy it in place of the old container. You shouldn’t log into a running container and make configuration changes!

Every Docker container is created by adding a thin read-write layer on top of the read-only image it’s based on. However, it’s tightly coupled to the container’s lifecycle — it gets created when the container is created and it gets deleted when the container is deleted.

### Volume

A Docker volume is a unit of storage. Volumes which exist independently of containers and have their own life cycles, but they can be attached to containers.

Volumes are how you manage storage for stateful applications when the data needs to be persistent. You create a volume and attach it to your application container; it appears as a directory in the container’s filesystem. The container writes data to the directory, which is actually stored in the volume.

<details>
<summary>
Volumes declared in Docker images are created as a separate volume for each container, but you can also share volumes between containers. Just run a container with the `volumes-from` flag, which attaches another container’s volumes.
</summary>

```bash
docker volume create VOLUME

docker volume inspect VOLUME
```

By default, Docker creates new volumes with the built-in `local` driver. As the name suggests, volumes created with the local driver are only available to containers on the same node as the volume. You can use the `-d` flag to specify a different driver.

> Third-party volume drivers are available as plugins. These provide Docker with seamless access external storage systems such as cloud storage services and on-premises storage systems including SAN or NAS.

```bash
# this new container will have its own volume
docker container run --name todo2 -d <image-qqq>

docker container exec todo2 ls /data

# this container will share the volume from todo1
docker container run -d --name t3 --volumes-from todo1 <image-qqq>

docker container exec t3 ls /data
```

</details>

<details>
<summary>
Volumes are better used to preserve state between application upgrades, and then it’s better to explicitly manage the volumes.
</summary>

```bash
# target is the value of `VOLUME` in Dockerfile
export target='/data'
# create a volume named `todo-list` to store the data:
docker volume create todo-list

docker container run -d -p 8011:8080 -v todo-list:$target --name todo-v1 todo-image:v1

# add some data through the web app at http://localhost:8011

docker container rm -f todo-v1

docker container run -d -p 8011:8080 -v todo-list:$target --name todo-v2 todo-image:v2
```

</details>

The `VOLUME` instruction in the Dockerfile and the `volume` (or `v`) flag for running containers are separate features.

- Images built with a `VOLUME` instruction will always create a volume for a container if there is no volume specified in the run command. The volume will have a random ID, so you can use it after the container is gone, but only if you can work out which volume has your data.

- The `volume` flag mounts a volume into a container whether the image has a volume specified or not. If the image does have a volume, the volume flag can override it for the container by using an existing volume for the same target path -- so a new volume won’t be created.

### Mounts

A bind mount makes a directory on the host available as a path on a container, which is a more direct way of sharing storage between containers.

Bind mounts let you explicitly use the filesystems on your host machine for container data. That could be a fast solid-state disk, a highly available array of disks, or even a distributed storage system that’s accessible across your network.

The bind mount is bidirectional. You can create files in the container and edit them on the host, or create files on the host and edit them in the container.

```bash
source="$(pwd)/databases" && target='/data'
mkdir ./database

docker container run --mount type=bind,source=$source,target=$target -d <some-image>

# mount with readonly flag
docker container run --mount type=bind,source=$source,target=$target,readonly -d <some-image>

ls ./database
```

**limitations of filesystem mounts**

- What happens when you run a container with a mount, and the mount target directory already exists and has files from the image layers? -> The source directory _replaces_ the target directory, so the original files from the image are not available.

- what happens if you mount a single file from the host to a target directory that exists in the container filesystem? -> This time _the directory contents are merged_, so you’ll see the original files from the image and the new file from the host.

- what happens if you bind-mount a distributed filesystem into a container? -> Distributed filesystems let you access data from any machine on the network, and they usually use different storage mechanisms from your operating system’s local filesystem. The mount will look like a normal part of the filesystem, but if it doesn’t support the same operations, your app could fail. (An application that uses a lot of disk may grind to a halt if you run it in a container with distributed storage, where every file write goes over the network.)

### Understanding how the container filesystem is built

Every container has a single disk, which is a virtual disk that Docker pieces together from serveral source. Docker calls this the _union filesystem_.

The union filesystem lets the container see a single disk drive and work with files and directories in the same way, wherever they may be on the disk.

Applications inside a container see a single disk, but as the image author or container user, you choose the sources for that disk. There can be multiple image layers, multiple volume mounts, and multiple bind mounts in a container, but they will always have a single writeable layer.

- **Writeable layer**: Perfect for short-term storage, like caching data to disk to save on network calls or computations. These are unique to each container but are gone forever when the container is removed.

- **Local bind mounts**: Used to share data between the host and the container. Developers can use bind mounts to load the source code on their computer into the container, so when they make local edits to HTML or JavaScript files, the changes are immediately in the container without having to build a new image.

- **Distributed bind mounts**: Used to share data between network storage and containers. These are useful, but you need to be aware that network storage will not have the same performance as local disk and may not offer full filesystem features. They can be used as read-only sources for configuration data or a shared cache, or as read-write to store data that can be used by any container on any machine on the same network.

- **Volume mounts**: Used to share data between the container and a storage object that is managed by Docker. These are useful for persistent storage, where the application writes data to the volume. When you upgrade your app with a new container, it will retain the data written to the volume by the previous version.

- **Image layers**: These present the initial filesystem for the container. Layers are stacked, with the latest layer overriding earlier layers, so a file written in a layer at the beginning of the Dockerfile can be overridden by a subsequent layer that writes to the same path. Layers are read-only, and they can be shared between containers.

The container sees the layers as the following order:

```
Container -> Writeable layer -> bind mount:local/distributed -> Volume mount -> Image layers
```

### Sharing storage across cluster nodes

Integrating external storage systems with Docker makes it possible to share volumes between cluster nodes. These external systems can be cloud storage services or enterprise storage systems in your on-permises data centers.

> As an example, a single storage LUN or NFS share can be presented to multiple Docker hosts, allowing it to be used by containers and service replicas no-matter which Docker host they're running on.

Building a setup like this requires a lot of things. You need access to a specialised storage systems and knowledge of how it works and presents storage. You also need to know how your applications read and write data to the shared storage. Finally, you need a volumes driver plugin that works with the external storage system.

Docker Hub is the best place to find volume plugins. Login to Docker Hub, select the view to show `plugins` instead of `containers`, and filter results to only show `Volume` plugins. Once you’ve located the appropriate plugin for your storage system, you create any configuration files it might need, and install it with `docker plugin install`.

Once the plugin is registered, you can create new volumes from the storage system using `docker volume create` with the `-d` flag.
