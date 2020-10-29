[back to home](./README.md)

## Docker Networking

Docker runs applications inside of containers, and applications need to communicate over lots of different networks.

Docker networking is based on an open-source pluggable architecture called the Container Network Model. `libnetwork` is Docker's real-world implementation of the CNM, and it provides all of Docker's core networking capabilities. Drivers plug in to `libnetwork` to provide specific network topologies.

`libnetwork` provides a native service discovery and basic container load balancing solution.

### The theroy

At the highest level, Docker networking comprises three major components:

- TheContainerNetworkModel(CNM)
- libnetwork
- Drivers

The CNM is the design specification, which outlines the fundamental building blocks of a Docker network.

`libnetwork` is a real-world implementation of the CNM, which is written in Go.

Drivers extend the model by implementing specific network topologies such as VXLAN overaly networks.

**The Container Network Model**

It outlines the fundamental building blocks of a Docker network, and you can read the full spec [here](https://github.com/docker/libnetwork/blob/master/docs/design.md). The Container Network Model is all about providing networking to containers.

It defines three major building blocks:

- **Sandboxes**: an isolated network stack, including: Ethernet interfaces, ports, routing tables and DNS config.

- **Endpoints**: virtual network interfaces, responsible for making connections. In the case of the CNM, it's the job of the _endpoint_ to connect a _sandbox_ to a _network_.

  **One endpoint con only be connected to one single network**. Therefore, if a container needs connecting to multiple networks, it will need multiple endpoints.

- **Networks**: a software implementation of on switch (802.1d bridge), which will group together and isolate a collection of endpoints that need to commuicate.

**libnetwork**

The CNM is the design doc, and `libnetwork` is the canonical implementation.

It implements native _service discovery_, _ingress-based container load balancing_, and the network control panel and managment plane functionality.

**Drivers**

Drivers implement the data plane. Connectivity and isolation is all handled by drivers. So is the actual creation of networks. On Linux they include; `bridge`, `overlay` and `macvlan`. Each driver is in charge of the actual creation and management of all resources on the networks it is responsible for.

`libnetwork` allows multiple network drivers to be active at the same time.

### Single-host bridge networks

This is the simplest type of Docker network.

_Single-host_ tells that it only exists on a single Docker host and can only connect containers that are on the same host.

_Bridge_ tells us that it's an implementation of an 802.1d bridge.

Docker on Linux creates single-host bridge networks with the built-in `bridge` driver, (`nat` driver on Windows).

Every Docker host gets a default single-host bridge network. By default, this is the network that all new containers will be connected to unless you override it on the command line with the `--network` flag.

The default _bridge_ network, on all Linux-based Docker hosts, maps to an underlying Linux bridge in the kernel called _docker0_.

```bash
docker network inspect bridge | grep bridge.name
```

Port mappings let you map a container to a port on teh Docker host. Any traffic hitting the Docker host on the configured port will be redirected to the container.

```bash
# list port mappings or a specific mapping for the container
docker port CONTAINER  [PRIVATE_PORT[/PROTO]]
```

### Service discovery

_Service discovery_ allows all containers and Swarm services to locate each other by name. The only requirement is that they be on the same network.

Under the hood, this leverages Docker's embedded DNS server and the DNS resolver in each container.

Every container has a local DNS resolver. If some service name miss hitting on local DNS resolver, the local DNS resolver would initiate a recursive query to the Docker DNS server. The local resolver is pre-configured to know how to reach the Docker DNS server. The Docker DNS server holds name-to-IP mappings for all containers created with the `--name` or `--net-alias` flags.

Every Swarm service and standalone container started with the `--name` flag will register its name and IP with the Docker DNS service.

However, service discovery is _network-scoped_. This means that name resolution only works for containers and Services on the same network. If two containers are on different networks, they will not be able to resolve each other.

It’s possible to configure Swarm services and standalone containers with customized DNS options. For example, the `--dns` flag lets you specify a list of custom DNS servers to use in case the embedded Docker DNS server cannot resolve a query. This is common when querying names of services outside of Docker. You can also use the `--dns-search` flag to add custom search domains for queries against unqualified names.

```bash
docker container run -it --name c1 \
  --dns=8.8.8.8 \
  --dns-search=bing.com \
  alpine sh
```

### Ingress load balancing

Swarm supports two publishing modes that make services accessible outside the cluster: _Ingress mode(default)_, _Host mode_.

Services published via _ingress mode_ can be accessed from any node in the Swarm — even nodes not running a service replica.

Services published via _host mode_ can only be accessed by hitting nodes running service replicas.

```bash
docker service create -d --name svc1 \
  --publish published=5000,target=80,mode=host \
  nginx
```

## Docker overlay networking

Overlay networking allows you to create a flat, secure, layer-2 network, spanning multiple hosts. Containers connected to this network can communicate directly.

By default, Docker overlay networks encrypt cluster management traffic but not application traffic. You must explicitly enable encryption of application traffic.

Overlay networks are only extended to worker nodes when they are tasked with running a container on it. This lazy approach to extended overlay networks improves network scalability by reducing the amount of network gossip.

When the Swarm starts a container on an overlay network, it automatically extends that network to the node the container is running on.

Standalone containers that are not part of a swarm service cannot attach to overlay networks unless they have the `attachable=true` property. The following command can be used to create an attachable overlay network that standalone containers can also attach.

```bash
docker network creat -d overlay --attachable NETWORK_NAME

# it'll display the containers attached
docker network inspect OVERLAY_NETWORK
```

On overlay networking, the control plane of all overlay networks is encrypted by default, but you have to explicitly encrypt the data plane. The control plane is for network management traffic and the data plane is for application traffic. Encrypting the data plane has a potential performance overhead.

To encrypt the data plane, you have two choices:

- Pass the `-o encrypted` flag to the `docker network create` command.

- Specify `encrypted:'yes'` under `driver_opts` in the stack file.

## Summary

The **Docker Engine** comes with three types of networks by default. These are **bridged**, **host**, and **none**.

- The bridged network is the default choice unless otherwise specified. In this mode, the container has its own networking namespace and is then bridged via virtual interfaces to the host (or node in the case of K8s) network. In the bridged network, two containers can use the same IP range because they are completely isolated. Therefore, service communication requires some additional port mapping through the host side of network interfaces.

- Docker also supports a host network, which allows the containers to use the host network stack. Performance is greatly benefited since it removes a level of network virtualization; however, you lose the security of having an isolated network namespace. Additionally, port usage must be managed more carefully since all containers share an IP.

- Finally, Docker supports a none network, which creates a container with no external interface. Only a loopback device is shown if you inspect the network interfaces.

In all these scenarios, we are still on a single machine, and outside of a host mode, the container IP space is not available, outside that machine. Connecting containers across two machines then requires _NAT_ and _port mapping_ for communication.
