[Back to Top](./README.md)

# Kubernetes Constructs

## The architecture

Kubernetes gives us automation and tooling to ensure high availability, application stack, and service-wide portability.

Kubernetes also allows finer control of resource usage, such as CPU, memory, and disk space across the infrastructure.

All the pieces of Kubernetes are constantly working to monitor the current actual state and synchronize it with the desired state defined by the administrators via the API server or `kubectl` script.

### Master

In the **master** node, we have the core API server, which maintains RESTful web services for querying and defining our desired cluster and workload state. It's important to note that the control pane only accesses the master to initiate changes and not the nodes directly.

Additionally, the master includes the **scheduler**, which works with the API server to schedule workloads in the form of pods on the actual minion nodes.

The **replication controller/replica set** works with the API server to ensure that the correct number of pod replicas are running at any given time.

Also, we have `etcd` running as a distributed configuration store. The Kubernetes state is stored here and `etcd` allows values to be watched for changes.

### Node / minions

In each node, we have a couple of components.

`kubelet` interacts with the API server to update the state and to start new workloads that have been invoked by the scheduler.

`kube-proxy` provides basic load balancing and directs the traffic destined for specific services to the proper pod on the backend.

Also, there are some default pods running various infrastructure services for each node, including DNS, logging, health checks.

## Core constructs

These abstractions will make it easier to think about our applications and ease the burden of life cycle management, high availability, and scheduling.

### Pods

Pods allow you to keep related containers close in terms of the network and hardware infrastructure. Pods essentially allow you to logically group containers and pieces of our application stacks together.

> Data can live near the application, so processing can be done without incurring a high latency from network traversal. Similarly, common data can be stored on volumes that are shared between a number of containers.

Pods give us a logical group of containers that we can then replicate, schedule, and balance service endpoints across. If the process in a container crashes, Kubernetes automatically restarts it.

For example, they all share the same network namespace, which means that each container in a Pod can see the other containers in the Pod on `localhost`. Pods also share the process and interprocess communication namespaces so that different containers can use tools, like shared memory and signaling, to coordinate between the different processes in the Pod.

> Keeping the container images separate generally makes it more agile for different teams to own or reuse the container images, but grouping them together in a Pod at runtime enables them to operate cooperatively.

### Services

A `Service` represents a TCP or UDP load-balanced service, spreading traffic to these different Pod replicas.

> Using a reliable endpoint, users and other programs can access pods running on your cluster seamlessly.

Every Service that is created, whether TCP or UDP, gets three things:

- Its own virtual but fixed IP address
- A DNS entry in the Kubernetes cluster DNS
- Load-balancing rules that proxy traffic to the Pods that implement the Service

Kubernetes achieves this by making sure that every node in the cluster runs a proxy named `kube-proxy`. The job of `kube-proxy` is to proxy communication from a service endpoint back to the corresponding pod that is running the actual application.

> Updates to service definitions are monitored and coordinated from the Kubernetes cluster master and propagated to the `kube-proxy` daemons running on each node.

The service could use label selectors for pod membership.

The Service load balancing is programmed into the network fabric of the Kubernetes cluster so that any container that tries to talk to the Service IP address is correctly load balanced to the corresponding Pods.

This programming of the network fabric is dynamic, so as Pods come and go due to failures or scaling of a ReplicaSet, the load balancer is constantly reprogrammed to match the current state of the cluster.

### Replication controllers

Replication controllers (RCs) manage the number of nodes that a pod and included container images run on. They ensure that an instance of an image is being run with the specific number of copies.

Replication controllers are simply charged with ensuring that you have the desired scale for your application.

<details>
<summary>

**Example configuration file**

</summary>

```yaml
apiVersion: v1 # schema version
kind: ReplicationController #  the type of resource
metadata:
  name: node-js # the name of the resource
  labels: # labels which will be used for searching/selecting
    name: node-js
spec:
  replicas: 3 # number of pods
  selector:
    #  the selector values need to match the labels values specified in the pod template.
    name: node-js #  tells the controller which pods to watch
  template: # a template to launch a new pod
    metadata:
      labels:
        name: node-js
    spec:
      containers:
        - name: node-js
          image: jonbaier/node-express-info:latest
          ports:
            - containerPort: 80
```

```yaml
apiVersion: v1
kind: Service
metadata:
  name: node-js
  labels:
    name: node-js
spec:
  type: LoadBalancer
  ports:
    - port: 80
    selector:
      name: node-js
```

</details>

### Replica sets

A `ReplicaSet` ensures that, for a given Pod definition, a number of replicas exists within the system. The actual replication is handled by the Kubernetes controller manager, which creates Pod objects that are scheduled by the Kubernetes scheduler.

> Also, the usage of ReplicationController is strongly discouraged in favor of ReplicaSets.

<details>
<summary>

**Example configuration file**

</summary>

```yaml
apiVersion: extensions/v1beta1
kind: ReplicaSet
metadata:
  name: node-js-rs
spec:
  replicas: 3
  selector:
    matchLabels:
      app: node-js-express
      deployment: test
    matchExpressions:
      - { key: name, operator: In, values: [node-js-rs] }
  template:
    metadata:
      labels:
        name: node-js-rs
        app: node-js-express
        deployment: test
    spec:
      containers:
        - name: node-js-rs
          image: jonbaier/node-express-info:latest
          ports:
            - containerPort: 80
```

</details>

## Health checks

Kubernetes provides two layers of health checking.

1. HTTP or TCP checks:

   Kubernetes can attempt to connect to a particular endpoint and give a status of healthy on a successful connection.

1. Application-specific health checks can be performed using command-line scripts.

<details>
<summary>

**Example configuration file**

</summary>

```yaml
apiVersion: v1
kind: ReplicationController
metadata:
  name: node-js
  labels:
    name: node-js
spec:
  replicas: 3
  selector:
    name: node-js
  template:
    metadata:
      labels:
        name: node-js
    spec:
      containers:
        - name: node-js
          image: jonbaier/node-express-info:latest
          ports:
            - containerPort: 80
          livenessProbe:
            # An HTTP health check
            httpGet:
              path: /status/
              port: 80
            initialDelaySeconds: 30
            timeoutSeconds: 1

          readinessProbe:
            # An HTTP health check
            httpGet:
              path: /status/
              port: 80
            initialDelaySeconds: 30
            timeoutSeconds: 1

          livenessProbe:
            # An TCP health check
            tcpSocket:
              port: 80
            initialDelaySeconds: 15
            timeoutSeconds: 1

          livenessProbe:
            exec:
              command:
              - /usr/bin/health/checkHttpService.sh
            initialDelaySeconds: 90
            timeoutSeconds: 1
```

Note the addition of the `livenessProbe` element. This is our core health check element. From here, we can specify `httpGet`, `tcpScoket`, or `exec`.

The probe will check the path and port specified and _restart_ the pod if it doesn't successfully return.

There is a separate `readinessProbe` that will remove a container from the pool of pods answering service endpoints.

</details>

## Life cycle hooks or graceful shutdown

[Container Lifecycle Hooks](https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/)

As you run into failures in real-life scenarios, you may find that you want to take additional action before containers are shutdown or right after they are started. Kubernetes actually provides life cycle hooks for just this kind of use case.

<details>

<summary>

The following example controller definition defines both a `postStart` action and a `preStop` action to take place before Kubernetes moves the container into the next stage of its life cycle.

It's important to note that hook calls are delivered at least once. Therefore, any logic in the action should gracefully handle multiple calls.

Another important note is that `postStart` runs before a pod enters its ready state. If the hook itself fails, the pod will be considered unhealthy.

</summary>

```yaml
apiVersion: v1
kind: ReplicationController
metadata:
  name: apache-hook
  labels:
    name: apache-hook
spec:
  replicas: 3
  selector:
    name: apache-hook
  template:
    metadata:
      labels:
        name: apache-hook
    spec:
      containers:
        - name: apache-hook
          image: bitnami/apache:latest
          ports:
            - containerPort: 80
          lifecycle:
            postStart:
              # make an HTTP call to the endpoint and port
              httpGet:
                path: http://my.registration-server.com/register/
                port: 80

            preStop:
              # runs a local command in the container
              # a parameter named `reason` will be sent to the handler as a parameter
              exec:
                command: ['/usr/local/bin/apachectl', '-k', 'graceful-stop']
```

</details>

## Application scheduling

The default behavior for the Kubernetes scheduler is to spread container replicas across the nodes in the cluster. In the absence of all other contstraints, the scheduler will place new pods on nodes with the least number of other pods belonging to matching services or replication controllers.

Additionally, the scheduler provides the ability to add constraints based on resources available to the node. Today, this includes minimum CPU and memory allocations.

When additional constraintsare defined, Kubernetes will check a node for available resources. If a node does not meet all the constraints, it will move to the next. If no nodes can be found that meet the criteria, then we will see a scheduling error in the logs.

<details>
<summary>

**Example configuration file**: requesting _512 Mi_ for memory and _1500 m_ for CPU.

</summary>

```yaml
apiVersion: v1
kind: ReplicationController
metadata:
  name: node-js-constraints
  labels:
    name: node-js-constraints
spec:
  replicas: 3
  selector:
    name: node-js-constraints
  template:
    metadata:
      labels:
        name: node-js-constraints
    spec:
      containers:
        - name: node-js-constraints
          image: jonbaier/node-express-info:latest
          ports:
            - containerPort: 80
          resources:
            limits:
              memory: '512Mi'
              cpu: '1500m' # '500m'
```

```bash
kubectl apply -f nodejs-constraints-controller.yml

kubectl get pods

kubectl describe pods/<pod-id>
```

</details>

## Organizing the Cluster with Namespaces, Labels, and Annotations

### Namespaces

You can think of a `Namespace` as something like a folder for your Kubernetes API objects.

> Namespaces provide directories for containing most of the other objects in the cluster. Namespaces can also provide a scope for role-based access control (RBAC) rules.

Every Kubernetes cluster has a single built-in Namespace named `default`, and most installations of Kubernetes also include a Namespace named `kube-system`, where cluster administration containers are created.

Namespaces are also placed into the DNS names created for Services and the DNS search paths that are provided to containers.

### Labels and label queries

Labels brings us another level of categorization, which is very helpful in terms of operations and management. Every object in the Kubernetes API can have an arbitrary set of labels associated with it.

> Similar to tags, labels can be used as the basis of service discovery as well as a useful grouping tool for day-to-day operations and management tasks.

Labels are just simple key-value pairs. The label acts as a selector and tells Kubernetes which resources to work with for a variety of operations.

`label queries`, or `label selectors`, is used to identify sets of objects that they apply to.

### Annotations

Not every metadata value that you want to assign to an API object is identifying information. Some of the information is simply an `annotation` about the object itself.
