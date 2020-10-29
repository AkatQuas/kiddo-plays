[Back to Top](./README.md)

# Kubernetes Architecture

## Declarative Configuration

The notion of _declarative configuration_—when a user declares a desired state of the world to produce a result—is one of the primary drivers behind the development of Kubernetes.

Kubernetes, takes that declarative statement and takes responsibility for ensuring that it is true.

Because Kubernetes understands your desired state, it can take autonomous action, independent of user interaction. This means that it can implement automatic self-correcting and self-healing behaviors.

## Reconciliation or Controllers

To achieve these self-healing or self-correcting behaviors, Kubernetes is structured based on a large number of _independent reconciliation_ or _control loops_.

When designing a system like Kubernetes, there are generally two different approaches that you can take:

- **a monolithic state-based approach**: the system is aware of the entire state of the world and uses this complete view to move everything forward in a coordinated fashion. The problem with the monolithic approach is that it is not particularly stable. If anything unexpected happens, the entire system can come crashing down.

- **a decentralized controller–based approach**: the system is composed of a large number of controllers, each performing its own independent reconciliation loop. Each individual loop is only responsible for a small piece of the system (e.g., updating the list of endpoints for a particular load balancer), and each small controller is wholly unaware of the rest of the world. This focus on a small problem and the corresponding ignorance of the broader state of the world makes the entire system significantly more stable. The downside of this distributed approach is that the overall behavior of the system can be harder to understand, since there is no single location to look for an explanation of why the system is behaving the way that it is. Instead, it is necessary to look at the interoperation of a large number of independent processes.

The control loop design pattern makes Kubernetes more flexible and stable and is repeated throughout Kubernetes’ system components.

The basic idea behind a control loop is that it is continually repeating the following steps:

1. Obtain the desired state of the world.

1. Observe the world.

1. Find differences between the observation of the world and the desired state of the world.

1. Take actions to make the observation of the world match the desired state.

## Implicit or Dynamic Grouping

It is necessary and common to identify a set of things in Kubernetes. When grouping things together into a set, there are two possible approaches:

- **explicit/static grouping**: every group is definde by a concrete list. The list explicitly calls out the name of each member of the group, and the list is static—that is, the membership doesn’t change unless the list itself changes. Static grouping is very inflexible.

- **implicit/dynamic grouping**: instead of the list of members, the group is defined by a implicitly statement. The members are implied by evaluating the group definition. The memebership of the group is likewise dynamic and changing. Dynamic grouping is more flexible and stable, and it can handle a changing environment without requiring constant adjustments to static lists.

In Kubernetes, this implicit grouping is achieved via labels and label queries or label selectors.

> Every API object in Kubernetes can have an arbitrary number of key/value pairs called _labels_ than are associated with the object. You can then use a label query or label selector to identify a set of objects that matches that query.

> Every Kubernetes object has both labels and annotations. Initially they might seem redundant, but their uses are different. Labels can be queried and should provide information that serves to identify the object in some way. Annotations cannot be queried and should be used for general metadata about the object—metadata that doesn’t represent its identity.

# Structure

## Unix Philosophy

Kubernetes ascribes to the general Unix philosophy of modularity and of small pieces that do their jobs well.

Kubernetes is a collection of different applications that all work together, largely ignorant of each other, to implement the overall system.

> Even when there is a binary (e.g., the controller manager) that groups together a large number of different functions, those functions are held almost entirely independently from each other in that binary. Sometimes these pieces are compiled into a single binary executable, but even when this occurs, they still communicate through the API server rather than directly within the running process.

The advantage of this modular approach is that Kubernetes is flexible. Large pieces of functionality can be ripped out and replaced without the rest of the system noticing or caring.

The downside is the complexity, since deploying, monitoring, and understanding the system requires integrating information and configuration across a number of different tools.

## API-Driven Interactions

All interaction among components is driven through a centralized API surface area. An important corollary of this design is that the API that the components use is the exact same API used by every other cluster user.

This brings two important consequences for Kubernetes:

- no part of the system is more privileged or has more direct access to internals than any other. Indeed, with the exception of the API server that implements the API, no one has access to the internals at all.

- every component can component can be swapped for an alternative implementation, and new functionality can be added without rearchitecting the core components. Even core components like the scheduler can be swapped out and replaced with alternative implementations.

## Components

The implementation of Kubernetes actually subdivides the set of machines into two groups: worker nodes and head nodes.

Most of the components that make up the Kubernetes infrastructure run on _head_ or _control plane_ nodes. There are a limited number of such nodes in a cluster, generally one, three or five. These nodes run the components that implement Kubernetes, like `etcd` and the API server. There is an odd number of these nodes, since they need to keep quorum in a shared state using a Raft/Paxos algorithm for quorum.

The cluster’s actual work is done on the worker nodes. These nodes also run a more limited selection of Kubernetes components. Finally, there are Kubernetes components that are scheduled to the Kubernetes cluster after it is created. From a Kubernetes perspective, these components are indistinguishable from other workloads, but they do implement part of the overall Kubernetes API.

### Head Node Components

A head node is the brain of the Kubernetes cluster. Typically, only these components run on head nodes; there are no user containers that share these nodes.

**`etcd`**

The `etcd` system is at the heart of any Kubernetes cluster. It implements the key-value stores where all of the objects in a Kubernetes cluster are persisted.

The `etcd` servers implement a distributed consensus algorithm, namely Raft, which ensures that even if one of the storage servers fails, there is sufficient replication to maintain the data stored in `etcd` and to recover data when an `etcd` server becomes healthy again and readds itself to the cluster.

The etcd servers also provide two other important pieces of functionality that Kubernetes makes heavy use of:

_optimistic concurrency_

Every value stored in etcd has a corresponding resource version. When a key-value pair is written to an etcd server, it can be conditionalized on a particular resource version. This means that, using etcd, you can implement _compare and swap_, which is at the core of any concurrency system.

Compare and swap enables a user to read a value and update it knowing that no other component in the system has also updated the value. These assurances enable the system to safely have multiple threads manipulating data in etcd without the need for pessimistic locks, which can significantly reduce throughput to the server.

_watch protocol_

The value of watch is that it enables clients to efficiently watch for changes in the key-value stores for an entire directory of values. As an example, all objects in a Namespace are stored within a directory in etcd. The use of a watch enables a client to efficiently wait for and react to changes without continuous polling of the etcd server.

**API server**

There is actually only a single server that is allowed to have direct access to the Kubernetes cluster, and that is the API server.

The API server is the hub of the Kubernetes cluster; it mediates all interactions between clients and the API objects stored in etcd. Consequently, it is the central meeting point for all of the various components. [More on here](./api-server.md).

**Scheduler**

With etcd and the API server operating correctly, a Kubernetes cluster is, in some ways, functionally complete. You can create all of the different API objects, like Deployments and Pods. However, you will find that it never begins to run. [More on here](./scheduler.md).

Finding a location for a Pod to run is the job of the Kubernetes scheduler. The scheduler scans the API server for unscheduled Pods and then determines the best nodes on which to run them. TBC.

**Controller manager**

After etcd, the API server, and the scheduler are operational, you can successfully create Pods and see them scheduled out onto nodes, but you will find that ReplicaSets, Deployments, and Services don’t work as you expect them to.

This is because all of the reconciliation control loops needed to implement this functionality are not currently running. Executing these loops is the job of the controller manager. The controller manager is the most varied of all of the Kubernetes components, since it has within it numerous different reconciliation control loops to implement many parts of the overall Kubernetes system.

### Components On All Nodes

These pieces implement essential functionality that is required on all nodes.

**kubelet**

The kubelet is the node daemon for all machines that are part of a Kubernetes cluster.

The kubelet is the bridge that joins the available CPU, disk, and memory for a node into the large Kubernetes cluster.

The kubelet communicates with the API server to find containers that should be running on its node. Likewise, the kubelet communicates the state of these containers back up to the API server so that other reconciliation control loops can observe the current state of these containers.

In addition to scheduling and reporting the state of containers running in Pods on their machines, kubelets are also responsible for health checking and restarting the containers that are supposed to be executing on their machines.

Also, the kubelet runs the reconciliation loop itself. If a container being run by the kubelet dies or fails its health check, the kubelet restarts it, while also communicating this health state (and the restart) back up to the API server.

**kube-proxy**

The kube-proxy is responsible for implementing the Kubernetes `Service` load-balancer networking model.

The kube-proxy is always watching the endpoint objects for all Services in the Kubernetes cluster. The kube-proxy then programs the network on its node so that network requests to the virtual IP address of a Service are, in fact, routed to the end‐ points that implement this Service.

Every Service in Kubernetes gets a virtual IP address, and the kube-proxy is the daemon responsible for defining and implementing the local load balancer that routes traffic from Pods on the machine to Pods, anywhere in the cluster, that implement the Service.

### Scheduled Components

**KubeDNS**

The first of these scheduled components is the KubeDNS server.

When a Kubernetes Service is created, it gets a virtual IP address, but that IP address is also programmed into a DNS server for easy service discovery. The KubeDNS containers implement this name-service for Kubernetes Service objects.

The KubeDNS Service is itself expressed as a Kubernetes Service, so the same routing provided by the kube-proxy routes DNS traffic to the KubeDNS containers.

The one important difference is that the KubeDNS service is given a static virtual IP address. This means that the API server can program the DNS server into all of the containers that it creates, implementing the naming and service discovery for Kubernetes services.

> The ability for the DNS service to be swapped out shows both the modularity and the value of using Kubernetes to run components like the DNS server. Replacing KubeDNS with CoreDNS is as easy as stopping one Pod and starting another.

**Heapster**

The other scheduled component is a binary called Heapster, which is responsible for collecting metrics like CPU, network, and disk usage from all containers running inside the Kubernetes cluster.

These metrics can be pushed to a monitoring system, like InfluxDB, for alerting and general monitoring of application health in the cluster.

Also, importantly, these metrics are used to implement autoscaling of Pods within the Kubernetes cluster. Kubernetes has an autoscaler implementation.

Heapster is the component that collects and aggregates these metrics to power the reconciliation loop implemented by the autoscaler. The autoscaler observes the current state of the world through API calls to Heapster.
