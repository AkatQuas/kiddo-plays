[back to home](./README.md)

## Security in Docker

Security is all about layers.

```bash
# Docker Platform technologies
Secrets Management
Docker Content Trust
Image Scanning
Swarm Mode

# OS (Linux) technologies
seccomp
Mandatory Access Control
Capabilities
Control groups (cgroups)
Kernel namespaces
```

- **Docker Swarm Mode** is secure by default. You get all of the following with zero configuration required; _cryptographic node IDs_, _mutual authentication_, _automatic CA configuration_, _automatic certificate rotation_, _encrypted cluster store_, _encrypted networks_, and more.

- **Docker Content Trust (DCT)** lets you sign your images and verify the integrity and publisher of images you consume.

- **Image security** scanning analyses images, detects known vulnerabilities, and provides detailed reports.

- **Docker secrets** are a way to securely share sensitive data and are first-class objects in Docker. They’re stored in the encrypted cluster store, encrypted in-flight when delivered to containers, stored in in-memory filesystems when in use, and operate a least-privilege model.

### Linux security technologies

All good container platforms use _namespaces_ and _cgroups_ to build containers.

The best container platforms will also integrate with other Linux security technologies such as _capabilities_, _Mandatory Access Control_ systems like SELinux and AppArmor, and seccomp.

Docker integrates with them all.

**Namespaces**

Kernel namespaces are at the very heart of containers. They slice up an operating system (OS) so that it looks and feels like multiple _isolated_ operating systems.

This lets us do really cool things like run multiple web servers on the same OS without having port conflicts.

> Namespaces let you run multiple web servers, each on port 443, on a single OS. To do this you just run each web server app inside of its own _network namespace_. This works because each network namespace gets its own IP address and full range of ports.
>
> You can run multiple applications, each requiring their own version of a shared library or configuration file. To do this you run each application inside of its own _mount namespace_.

Docker on Linux currenty utilizes the following kernel namespaces:

- ProcessID(pid)
- Network(net)
- Filesystem/mount(mnt)
- Inter-process Communication(ipc)
- User(user)
- UTS(uts)

Docker containers are an organized collection of namespaces. This means that you get all of this OS isolation for free with every container.

> Every container has its own _pid_, _net_, _mnt_, _ipc_, _uts_, and potentially _user_ namespace. In fact, an organized collection of these namespaces is what we call a _container_.

Let’s briefly look at how Docker uses each namespace:

- **Process ID namespace**: Docker uses the _pid_ namespace to provide isolated process trees for each container. This means every container gets its own PID 1. PID namespaces also mean that one container cannot see or access to the process tree of other containers. Nor can it see or access the process tree of the host it’s running on.
- **Network namespace**: Docker uses the _net_ namespace to provide each container its own isolated network stack. This stack includes; interfaces, IP addresses, port ranges, and routing tables. For example, every container gets its own _eth0_ interface with its own unique IP and range of ports.
- **Mount namespace**: Every container gets its own unique isolated root (/) filesystem. This means every container can have its own _/etc_, _/var_, _/dev_ and other important filesystem constructs. Processes inside of a container cannot access the mount namespace of the Linux host or other containers — they can only see and access their own isolated filesystem.
- **Inter-process Communication namespace**: Docker uses the _ipc_ namespace for shared memory access within a container. It also isolates the container from shared memory outside of the container.
- **User namespace**: Docker lets you use _user_ namespaces to map users inside of a container to different users on the Linux host. A common example is mapping a container’s root user to a non-root user on the Linux host.
- **UTS namespace**: Docker uses the _uts_ namespace to provide each container with its own hostname.

**Control Groups**

If namespaces are about isolation, control groups (cgroups) are about setting limits.

> Think of containers as similar to rooms in a hotel. While each room might appear isolated, every room shares a common set of infrastructure resources — things like water supply, electricity supply, shared swimming pool, shared gym, shared breakfast bar etc. Cgroups let us set limits so that (sticking with the hotel analogy) no single container can use all of the water or eat everything at the breakfast bar.

In the real world, not the hotel analogy, containers are isolated from each other but all share a common set of OS resources — things like CPU, RAM, network bandwidth, and disk I/O. Cgroups let us set limits on each of these so a single container cannot consume everything and cause a denial of service (DoS) attack.

**Capabilities**

It’s a bad idea to run containers as root — root is all-powerful and therefore very dangerous.

_capabilities_ is a technology that lets us pick and choose which root powers a container needs in order to run.

Under the hood, the Linux root user is a combination of a long list of _capabilities_.

Docker works with capabilities so that you can run containers as root, but strip out all the capabilities you don’t need.

This is an excellent example of implementing least privilege — you get a container running with only the capabilities required. Docker also imposes restrictions so that containers cannot re-add the dropped capabilities.

**Mandatory Access Control systems**

Docker works with major Linux MAC technologies such as AppArmor and SELinux.

Depending on your Linux distribution, Docker applies a default AppArmor profile to all new containers. According to the Docker documentation, this default profile is “moderately protective while providing wide application compatibility”.

Docker also lets you start containers without a policy applied, as well as giving you the ability to customize policies to meet specific requirements. This is also very powerful, but can also be prohibitively complex.

**seccomp**

Docker uses seccomp, in filter mode, to limit the syscalls a container can make to the host’s kernel.

As per the Docker security philosophy, all new containers get a default seccomp profile configured with sensible defaults. This is intended to provide moderate security without impacting application compatibility.

As always, you can customize seccomp profiles, and you can pass a flag to Docker so that containers can be started without a seccomp profile.

### Docker platform security technologies

**Security in Swarm Mode**

Docker Swarm allows you to cluster multiple Docker hosts and deploy applications declaratively. Every Swarm is comprised of _managers_ and _workers_ that can be Linux or Windows:

- Managers host the control plane of the cluster and are responsible for configuring the cluster and dispatching work tasks.
- Workers are the nodes that run your application code as containers.

As expected, _swarm mode_ includes many security features that are enabled out-of-the-box with sensible defaults. These include:

- Cryptographic node IDs
- TLS for mutual authentication
- Secure join tokens
- CA configuration with automatic certificate rotation
- Encrypted cluster store(config DB)
- Encrypted networks

**_Swarm join tokens_**

[reference](https://docs-stage.docker.com/engine/reference/commandline/swarm_join-token/)

The only thing that is needed to join new managers and workers to an existing swarm is the relevant join token. Join tokens are stored in the cluster store which is encrypted by default.

Every swarm maintains two distinct join tokens:

- One for joining new managers
- One for joining new workers

Every join token is comprised of 4 distinct fields separated by dashes (-):

    PREFIX - VERSION - SWARM ID - TOKEN

The _PREFIX_ is always _SWMTKN_. This allows you to pattern-match against it and prevent people from accidentally posting it publicly.

The _VERSION_ field indicates the version of the swarm.

The _Swarm ID_ field is a hash of the swarm’s certificate.

The _TOKEN_ field is the part that determines whether it can join nodes as managers or workers.

```bash
# revokes the existing manager join token and issues a new one.
docker swarm join-token --rotate worker

docker swarm join-token --rotate manager
```

Existing managers do not need updating, however, you’ll need to use the new token to add new managers.

**_TLS and mutual authentication_**

Every manager and worker that joins a swarm is issued a client certificate. This certificate is used for mutual authentication. It identifies the node, the swarm that it’s a member of, and role the node performs in the swarm (manager or worker).

```bash
# inspect a node's client certificate
sudo openssl x509 \
  -in /var/lib/docker/swarm/certificates/swarm-node.cert \
  -text

docker system info
```

```bash
docker swarm update --cert-expiry 720h

docker swarm ca --help
```

**_The cluster store_**

The cluster store is the brains of a swarm and is where cluster config and state are stored.

The store is currently based on the popular `etcd` distributed database and is automatically configured to replicate itself to all managers in the swarm. It is also encrypted by default.

**Detecting vulnerabilities with image security scanning**

Image scanners work by inspecting images and searching for packages that have known vulnerabilities. Image scanning is focussed on images and does not detect security problems with networks, nodes, or orchestrators.

**Signing and verifying images with Docker Content Trust**

Docker Content Trust (DCT) makes it simple and easy to verify the integrity and the publisher of images that you download and run.

At a high level, DCT allows developers to sign images when they are pushed to Docker Hub or other container registries. These images can then be verified when they are pulled and ran.

DCT can also be used to provide important _context_. This includes:

- whether or not an image has been signed for use in a particular environment such as “prod” or “dev”,
- whether an image has been superseded by a newer version and is therefore stale.

You can force a Docker host to always sign and verify image push and pull operations by exporting the `DOCKER_CONTENT_TRUST `environment variable with a value of 1. Once DCT is enabled, you’ll no longer be able to pull and work with unsigned images.

```bash
export DOCKER_CONTENT_TRUST=1
```

**Docker Secrets**

Behind the scenes, secrets are encrypted at rest, encrypted in-flight, mounted in containers to in-memory filesystems, and operate under a least-privilege model where they are only made available to services that have been explicitly granted access to them.

The reason that secrets are surfaced in their un-encrypted form in running containers is so applications can use them without requiring methods to decrypt them.
