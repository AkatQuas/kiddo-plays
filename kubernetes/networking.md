[Back to Top](./README.md)

# Networking, Load Balancers, Ingress

## Container Network Interface / CNI

Before we talk about how to connect users with containerized workloads, we need to understand how Pods communicate with other Pods. These Pods may be colocated on the same node, across nodes in the same subnet, and even on nodes in different subnets that are, perhaps, even located in different datacenters.

Kubernetes interfaces with the network using the CNI specification. The objective of this open specification is to standardize how container orchestration platforms con‐ nect containers with the underlying network and to do so in a pluggable way.

The role of CNI is simply to facilitate Pod-to-Pod connectivity. The container runtime (e.g., Docker) calls the CNI plug-in executable (e.g., Calico) to add or remove an interface to or from the container’s networking `Namespace`. These are termed `sandbox` interfaces.

> Every Pod is allocated an IP address, and _the CNI plug-in is responsible for its allocation and assignment_ to a Pod.

In addition to connecting a container to a network, CNI has capabilities for IP Address Management (IPAM). IPAM ensures that CNI always has a clear picture of which addresses are in use, as well as those that are available for configuration of new interfaces.

**kube-proxy**

With the `Service` resource, we assign a virtual IP for network services exposed by a collection of Pods. The backing Pods are discovered and connected using a Pod selector.

`kube-proxy` typically runs as a privileged container process, and it is responsible for managing the connectivity for these virtual Service IP addresses. `kube-proxy` is simply manipulating iptables rules on every node. These rules redirect traffic that is destined for a Service IP to any one of the backing endpoint IPs.

> Since `kube-proxy` is a controller, it watches for state changes and reconciles to the appropriate state upon any modifications.

In this way, every Pod on every node is able to communicate with defined `Services` by way of the `kube-proxy` daemon’s manipulation of iptables rules.

## Sevvice Discorvery

In any environment where there is a high degree of dynamic process scheduling, we want a means by which to reliably discover where Service endpoints are located.

**DNS**

The most common way to discover Services within Kubernetes is via DNS.

Although there are no native DNS controllers within the Kubernetes componentry itself, there are _add-on controllers_ that may be utilized for providing DNS records for Service resources.

> The two most widely deployed add-ons in this space are the `kube-dns` and `CoreDNS` controllers that are maintained by the community.

These controllers watch the Pod and Service state from the API server and, in turn, automatically define a number of different DNS records.

Every Service, upon creation, gets a DNS A record associated with the virtual Service IP, which takes the form of `<service name>.<namespace>.svc.cluster.local`.

## Network Policy

Kubernetes provides the `NetworkPolicy` resource for users to define layer 3 and layer 4 rules as they pertain to their own workloads.

The `NetworkPolicy` resource offers both ingress and egress rules that can be applied to namespaces, Pods, and even regular CIDR blocks.

> Note that `NetworkPolicy` can only be defined in environments where the CNI plug-in supports this functionality.

## Service Mesh

In a microservices environment, it is often typical for traffic to enter the cluster via an Ingress, which is backed by a Service, which is then backed by any number of Pod replicas. Further, these Pods might, themselves, connect to other clus‐ ter Services and their respective backing Pods. As you can probably see, these flows get intricate very quickly, and this is where service mesh solutions may help.

A service mesh is simply a collection of _smart proxies_ that can help users with a variety of east-west or Pod-to-Pod networking needs.

These proxies may operate as sidecar containers in the application Pods or may operate as DaemonSets, where they are node-local infrastructure components that may be utilized by any of the Pods on a given node.

> Simply configure your Pods to proxy their traffic to these service mesh proxies (typically with environment variables), and your Pods are now a part of the mesh.

Service mesh solutions typically provide common functionality.

**traffic management**

Most service mesh solutions include some features targeted at driving incoming requests at particular Services. Additionally, some solutions are protocol-aware. Instead of acting as a _dumb layer 4 proxy_, they have the ability to introspect higher-level protocols and make intelligent proxying decisions.

**observability**

When deploying microservices to a Kubernetes cluster, the interconnectivity between Pods can quickly become difficult to understand. Most service mesh solutions provide automatic mechanisms for distributed tracing (commonly based on the OpenTracing standard).

**security**

In environments where the underlying network provides no default encryption (which is common for most CNI plug-ins), service mesh can intercede by offering mutual TLS for all east-west traffic.

## Kubernetes networking

Networking in Kubernetes requires that each pod has its own IP address.

Kubernetes does not allow the use of Network Address Translation (NAT) for container-to-container or for container-to-node (minion) traffic. The internal container IP address must match the IP address that is used to communicate with it.

Kubernetes achieves this pod-wide IP magic using a **placeholder**. The `pause` container is often referred to as a _pod infrastructure container_, and it has the important job of reserving the network resources for the application containers that will be started later on. Essentially, the `pause` container holds the networking namespaces and IP address for the entire pod and can be used by all the containers running within. The `pause` container join first and holds the namespace while the subsequent containers in the pod join it when they start up. As such, they are the first container to be launched and the last to die in the life cycle of an individual Pod.

## Balanced design

Kubernetes is trying to achieve the balance by placing the IP at the pod level.

> If I have a web server and a database, we can keep them on the same pod and use a single IP address. The web server and database can use the local interface and standard ports to communicate, and no custom setup is required. Further, services on the backend are not needlessly exposed to other application stacks running elsewhere in the cluster (but possibly on the same host).

Since the pod sees the same IP address that the applications running within it see, service discovery does not require any additional translation.

## Advanced services

the IP strategy as it relates to services and communication between containers.

Kubernetes is using `kube-proxy` to determine the proper pod IP address and port serving each request. Behind the scenes, `kube-proxy` is actually using virtual IPs and iptables to make all this magic work.

`kube-proxy` now has two modes, _userspace_ and _iptables_. _iptables_ is the default mode.

In both modes, `kube-proxy` is running on every host. Its first duty is to monitor the API from the Kubernetes master. Any updates to services will trigger an update to iptables from `kube-proxy`. Since `kube-proxy` is running on all nodes, we have cluster-wide resolution for the service VIP (short for virtual IP). Additionally, DNS records can point to this VIP as well.

> For example, when a new service is created, a virtual IP address is chosen and a rule in iptables is set, which will direct its traffic to `kube-proxy` via a random port.

In the userspace mode, we have a hook created in iptables, but the proxying of traffic is still handled by `kube-proxy`. The iptables rule is only sending traffic to the service entry in `kube-proxy` at this point. Once `kube-proxy` receives the traffic for a particular service, it must then forward it to a pod in the service's pool of candidates. It does this using a random port that was selected during service creation.

> It is also possible to always forward traffic from the same client IP to the same backend pod/container using the `sessionAffinity` element in your service definition.

## External services

The `LoadBalancer` type creates an external load balancer on the cloud provider.

## Internal services

By default, services are only internally facing. You can specify a type of `clusterIP` to achieve this, but, if no type is defined, `clusterIP` is the assumed type.

```yaml
# the lack of the `type` element
apiVersion: v1
kind: Service
metadata:
  name: node-js-internal
  labels:
    name: node-js-internal
spec:
  ports:
    - port: 80
  selector:
    name: node-js
```

## Custom load balancing

Another type of service that Kubernetes allows is the `NodePort` type. This type allows us to expose a service through the host or node (minion) on a specific port. In this way, we can use the IP address of any node (minion) and access our service on the assigned node port.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: node-js-nodeport
  labels:
    name: node-js-nodeport
spec:
  ports:
    - port: 80
      nodePort: 30001
  selector:
    name: node-js
  type: NodePort
```

Similar to the external load balancer type, `NodePort` is exposing your service externally using ports on the nodes. This could be useful if, for example, you want to use your own load balancer in front of the nodes.

## Cross-node proxy

Remember that `kube-proxy` is running on all the nodes, so, even if the pod is not running there, the traffic will be given a proxy to the appropriate host.

> A user makes a request to an external IP or URL. The request is serviced by Node in this case. However, the pod does not happen to run on this node. This is not a problem because the pod IP addresses are routable. So, `kube-proxy` or `iptables` simply passes traffic onto the pod IP for this service. The network routing then completes on Node 2, where the requested application lives.

## Ingress

Although `Service` objects provide a great way to do simple TCP-level load balancing, proxying traffic to backing pod distributed throughout the cluster, they don’t provide an application-level way to do load balancing and routing.

The truth is that most of the applications that users deploy using containers and Kubernetes are HTTP web-based applications. These are better served by a load balancer that understands HTTP.

Kubernetes has added an `Ingress` resource, which represents a path and host-based HTTP load balancer and router.

When you create an Ingress object, it receives a virtual IP address just like a Service, but instead of the one-to-one relationship between a Service IP address and a set of Pods, _an Ingress can use the content of an HTTP request to route requests to different Services_.

> Think of it as an extra layer or hop in the routing path before traffic hits our service.

Just as an application has a service and backing pods, the Ingress resource needs both an _Ingress entry point_ and an _Ingress controller_ that perform the custom logic. The entry point defines the routes and the controller actually handles the routing.

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: whale-ingress
spec:
  rules:
    - host: a.whale.hey
      http:
        paths:
          - path: /
            backend:
              serviceName: whale-svc-a
              servicePort: 80
    - host: b.whale.hey
      http:
        paths:
          - path: /
            backend:
              serviceName: whale-svc-b
              servicePort: 80
```

```bash
kubectl get ingress

curl --resolve a.whale.hey:80:<ip> http://a.whale.hey/

curl --resolve b.whale.hey:80:<ip> http://b.whale.hey/
```
