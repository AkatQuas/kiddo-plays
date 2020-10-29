[Back to Top](./README.md)

# the Kubernetes Scheduler

There is a dedicated binary in the Kubernetes, which is called the Kubernetes scheduler, to schedule containers to work nodes in the cluster of machines.

Kubernetes can handle a wide variety of work‐ loads, from stateless web serving to stateful applications, big data batch jobs, or machine learning on GPUs. The key to ensuring that all of these very different applications can operate in harmony on the same cluster lies in the application of _job scheduling_, which ensures that each container is placed onto the worker node best suited to it.

## Overview

When a Pod is first created, it generally doesn’t have a `nodeName` field. The `nodeName` indicates the node on which the Pod should execute.

The Kubernetes scheduler is constantly scanning the API server (via a `watch` request) for Pods that don’t have a `nodeName`; these are Pods that are eligible for scheduling.

The scheduler then selects an appropriate node for the Pod and updates the Pod definition with the `nodeName` that the scheduler selected. After the `nodeName` is set, the kubelet running on that node is notified about the Pod’s existence (again, via a `watch` request) and it begins to actually execute that Pod on that node.

> If you want to skip the scheduler, you can always set the `nodeName` yourself on a Pod. This direct schedules a Pod onto a specific node. This is how the `DaemonSet` controller schedules a single Pod onto each node in the cluster.

## Scheduling Process

When the scheduler discovers a Pod that hasn’t been assigned to a node, it needs to determine which node to schedule the Pod onto. In general, the scheduler is trying to optimize a variety of different criteria to find the node that is best for the particular Pod.

### Predicates

Simply stated, a `predicate` indicates whether a Pod fits onto a particular node. Predicates are hard constraints, which, if violated, lead to a Pod not operating correctly (or at all) on that node.

> An example of a predicate is a node-selector label query specified by the user. In this case, the user has requested that a Pod only run on certain machines as indicated by the node labels. The predicate is false if a node does not have the required label.

### Priorites

There is a generic interface used by the scheduler to determine preference for one node over another. These preferences are expressed as `priorities` or `priority functions`. The role of a priority function is to score the relative value of scheduling a Pod onto a particular node.

> As an example, a priority function would weight nodes where the image has already been pulled. Therefore, the container would start faster than nodes where the image is not present and would have to be pulled, delaying Pod startup.

One important priority function is the `spreading` function. This function is responsible for prioritizing nodes where Pods that are members of the same Kubernetes `Service` are not present. It is used to ensure reliability, since it reduces the chances that a machine failure will disable all of the containers in a particular Service.

### High-Level algorithm

For every Pod that needs scheduling, the scheduling algorithm is run. At a high level, the algorithm looks like this:

```go
schedule(pod): string
  nodes := getAllHealthyNodes()
  viableNodes := []
  for node in nodes:
    for predicate in predicates:
      if predicate(node, pod):
        viableNodes.append(node)
  scoredNodes := PriorityQueue<score, Node[]>
  priorities := GetPriorityFunctions()
  for node in viableNodes:
    score = CalculateCombinedPriority(node, pod, priorities)
    scoredNodes[score].push(node)

  bestScore := scoredNodes.top().score
  selectedNodes := []
  while scoredNodes.top().score == bestScore:
    selectedNodes.append(scoredNodes.pop())

  node := selectAtRandom(selectedNodes) // RoundRobin selection
  return node.Name
```

## Conflicts

Because there is lag time between when a Pod is scheduled (time `T_1`) and when the container actually executes (time `T_N`), the scheduling decision may become invalid, due to other actions during the time interval between scheduling and execution.

In general, these sorts of soft-constraint conflicts aren’t that important and they normalize in the aggregate. These conflicts are thus ignored by Kubernetes. _Scheduling decisions are only optimal for a single moment in time_—they can always become worse as time passes and the cluster changes.

> You should always run Pods (even singletons) via a ReplicaSet or Deployment.

## Controlling Scheduling with Labels, Affinity, Taints, and Tolerations

### Node Selector

Every object in Kubernetes has an associated set of `labels`. Labels provide identifying metadata for Kubernetes objects, and `label selectors` are often used to dynamically identify sets of API objects for various operations.

Label selectors can also be used to identify a subset of the nodes in a Kubernetes clus‐ ter that should be used for scheduling a particular Pod. By default, all nodes in the cluster are potential candidates for scheduling, but by filling in the `spec.nodeSelector` field in a Pod or PodTemplate, the initial set of nodes can be reduced to a subset.

Kubernetes has a default predicate that requires every node to match the `nodeSelector` label query, if it is present.

### Node Affinity

Node selectors provide a simple way to guarantee that a Pod lands on a particular node, but they lack flexibility.

Affinity is a more complicated structure to understand, but it is significantly more flexible if you want to express more complicated scheduling policies.

[More on here](https://kubernetes.io/docs/tasks/configure-pod-container/assign-pods-nodes-using-node-affinity/)

### Taints and Tolerations

A node taint is exactly what it sounds like. When a taint is applied to a node, the node is considered tainted and will be excluded by default from scheduling. Any tainted node will fail a predicate check at the time of scheduling.

This toleration enables the scheduling predicate to pass and thus allows for the node to schedule onto the tainted machine.

It is important to note that, although a toleration for a taint enables a Pod to run on a tainted machine, it does not require that the Pod runs on the tainted machine.

Indeed, all of the priorities run just as before and, thus, all of the machines in the cluster are available to execute on.

**Forcing a Pod onto a particular machine is a use case for nodeSelectors or affinity as described earlier.**
