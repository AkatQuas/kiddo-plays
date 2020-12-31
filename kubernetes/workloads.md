[Back to Top](./README.md)

# Deployments, Jobs, and DaemonSets

Kubernetes supports various types of workloads:

- Deployments: regularly updated and long running applications
- Jobs: short-running tasks
- DaemonSets: programs to be run every node

## Deployments

Pods and ReplicaSets are expected to be tied to specific container images that don’t change.

The `Deployment` object was added to the Kubernetes API to represent this sort of _safe rollout_ from one version to another. A Deployment can hold pointers to multiple ReplicaSets, (e.g. v1 and v2), and it can control the slow and safe migration from one ReplicaSet to another.

Deployments allow us to pause and resume application rollouts. Additionally, it keeps a history of past deployments and allows the user to easily rollback to previous versions.

> Just as that ReplicaSets manage Pods, deployments manage ReplicaSets. [And It's not recommendded to use Deployments instead of directly using ReplicaSets.](https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/#when-to-use-a-replicaset)

Deployments feature a large number of different knobs that can be tuned to provide a safe rollout for the specific details of an application. Indeed, in most modern clusters, users exclusively use Deployment objects and don’t manage ReplicaSets directly.

```yaml
apiVersion: v1
kind: Deployment
metadata:
  annotations:
    deployment.kubernetes.io/revision: '1'
  creationTimestamp: null
  name: node-js-deploy
  labels:
    name: node-js-deploy
  selfLink: /apis/extensions/v1beta1/namespaces/default/deployments/node-js-deploy
spec:
  # the deployment must wait for 60 seconds after
  # seeing a Pod become healthy before moving on to updating the next Pod.
  minReadySeconds: 60
  # progress deadline
  # if any particular stage in the rollout fails (such as deadlocks immediately) to progress,
  # wait at most 2147483647 seconds, then the deployment is marked as failed,
  # all attempts to move the deployment forward are halted
  progressDeadlineSeconds: 2147483647
  replicas: 2
  # We do daily rollouts, limit the revision history
  # to 10 releases as we don't expect to roll back beyond that.
  revisionHistoryLimit: 10
  selector:
    matchLabels:
      name: node-js-deploy
  # rollout strategy, Recreate or RollingUpdate
  strategy:
    rollingUpdate:
      # how many extra resources can be created to achieve a rollout
      # absolute number (1,3,5) or percentage (20%)
      maxSurge: 1

      # set the maximum number of Pods that can be unavailable,
      # absolute number (1,3,5) or percentage (20%)
      maxUnavailable: 1
    type: RollingUpdate
  template:
    metadata:
      # useful for updating annotation
      annotations:
        kubernetes.io/change-cause: "Update to green kuard"
      creationTimestamp: null
      labels:
        name: node-js-deploy
    spec:
      containers:
        - name: node-js-deploy
          image: pod-scaling
          imagePullPolicy: IfNotPresent
          resources: {}
          terminationMessagePath: /dev/termination-log terminationMessagePolicy: File
          ports:
            - containerPort: 80
      dnsPolicy: ClusterFirst
      restartPolicy: Always
      schedulerName: default-scheduler
      securityContext: {}
      terminationGracePeriodSeconds: 30
status: {}

# Service
apiVersion: v1
kind: Service
metadata:
  name: node-js-deploy
  labels:
    name: node-js-deploy
spec:
  type: LoadBalancer
  ports:
    - port: 80
  sessionAffinity: ClientIP
  selector:
    name: node-js-deploy
```

Two of the most important pieces of information in the output from command `kubectl describe deployment <deployment-name>` are `OldReplicaSets` and `NewReplicaSet`. These fields point to the ReplicaSet objects this deployment is currently managing. If a deployment is in the middle of a rollout, both fields will be set to a value. If a rollout is complete, `OldReplicaSets` will be set to <none>.

```bash
# flag --record
# the creation of the deployment is recorded in the rollout history
kubectl apply -f /path/to/node-js-deploy.yaml --record

# manual scaling
kubectl scale deployment node-js-deploy --replicas 3

# manual update and rollout
kubectl set image deployment/node-js-deploy node-js-deploy=pod-scaling:0.2
kubectl rollout status deployment/node-js-deploy
```

Kubernetes has _rolled out_ a new version for us:

    It basically creates a new replica set with the new version. Once this pod is online and healthy it kills one of the older versions. It continues this behavior, scaling out the new version and scaling down the old versions, until only the new pods are left.

We could set the `strategy.type` field, which is default to `RollingUpdate`, to other values, such as `Recreate`.

**Recreate**

> `Recreate` will kill the old pods first before creating the new versions.

It simply _updates the ReplicaSet it manages to use the new image_ and _terminates all of the Pods associated with the deployment_. The ReplicaSet notices that it no longer has any replicas, and re-creates all Pods using the new image. Once the Pods are re-created, they are running the new version.

**RollingUpdate**

> `RollingUpdate` will create new pods to replace the old pods.

The RollingUpdate strategy works by _updating a few Pods_ at a time, _moving incrementally_ until all of the Pods are running the new version of your software.

```bash
# rollback
kubectl set image deployment/node-js-deploy node-js-deploy=pod-scaling:0.2
kubectl rollout history deployment/node-js-deploy

# something goes wrong, we need to rollback
kubectl rollout undo deployment/node-js-deploy

# chec kout the rollout status
kubectl rollout status deployment/node-js-deploy
```

```yaml
# autoscaling yaml configuration
apiVersion: extensions/v1beta1
kind: HorizontalPodAutoscaler
metadata:
  name: node-js-deploy
spec:
  minReplicas: 3
  maxReplicas: 6
  scaleTargetRef:
    apiVersion: v1
    kind: Deployment
    name: node-js-deploy
  targetCPUUtilizationPercentage: 10
# kubectl apply -f /path/to/deploy-hpa.yaml
```

Deployments and Replication Controllers are a great way to ensure long running applications are always up and able to tolerate a wide array of infrastructure failures.

**Rollout History**

Kubernetes deployments maintain a history of rollouts, which can be useful both for understanding the previous state of the deployment and to roll back to a specific version.

```bash
kubectl rollout history deployment <deployment-name>

kubectl rollout history deployment <deployment-name> --revision=2

kubectl rollout undo deployment <deployment-name>

kubectl rollout undo deployment <deployment-name> --to-revision=3
```

> When you roll back to a previous revision, the deployment simply reuses the template and renumbers it so that it is the latest revision.

## Jobs

Sometimes, we need the tasks to run until completion, but then terminate and start again at the next scheduled interval.

Kubernetes has added a _Batch API_, which includes the **Job** type. This type will create 1 to n pods and ensure that they all run to completion with a successful exit.

A Job contains the definition of the Pods it creates, the number of times the Job should be run, and the maximum number of Pods to create in parallel.

> A job creates Pods that run until successful termination (i.e., exit with 0). In contrast, a regular Pod will continually restart regardless of its exit code.

Based on `restartPolicy`, we can either allow pods to simply fail without retry (`restartPolicy: Never`) or retry when a pods exits without successful completion (`restartPolicy: OnFailure`).

If the Pod fails before a successful termination, the job controller will create a new Pod based on the Pod template in the job specification. Given that Pods have to be scheduled, there is a chance that your job will not execute if the required resources are not found by the scheduler.

```yaml
# longtask Job
apiVersion: batch/v1
kind: Job
metadata:
  name: long-task
spec:
  template:
    metadata:
      name: long-task
    spec:
      containers:
        - name: long-task
          image: docker/whalesay
          command: ['cowsay', 'Finishing that task in a jiffy']
      restartPolicy: OnFailure
# kubectl apply -f /path/to/longtask.yaml
```

> After the job has completed, the Job object and related Pod are still around. You may need to delete them manually?

### Job Patterns

By default, each job runs a single Pod once until successful termination.

| Type                       | Use case                                               | Behavior                                                                           | completions | parallelism |
| :------------------------- | :----------------------------------------------------- | :--------------------------------------------------------------------------------- | :---------- | :---------- |
| One shot                   | Database migrations                                    | A singlel Pod running once until successful termination                            | 1           | 1           |
| Parallel fixed completions | Multiple Pods processing a set of work in parallel     | One or more Pods running one or more times until reaching a fixed completion count | 1+          | 1+          |
| Work queue: parallel jobs  | Multiple Pods processing from a centralized work queue | Oneor more Pods running once until successful termination                          | 1           | 2+          |

**One Shot**

One-shot jobs provide a way to run a single Pod once until successful termination.

1. A Pod must be created and submitted to the Kubernetes API. This is done using a Pod template defined in the job configuration.

1. Once a job is up and running, the Pod backing the job must be monitored for successful termination. The job controller is responsible for recreating the Pod until a successful termination occurs.

> A job can fail for any number of reasons, including an application error, an uncaught exception during runtime, or a node failure before the job has a chance to complete.

<details>
<summary>A one-shot Job example</summary>

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: oneshot
spec:
  template:
    spec:
      containers:
        - name: oneshot
          image: docker/whalesay
          imagePullPolicy: Always
          args:
            - '--keygen-eanble'
            - '--keygen-exit-on-complete'
            - '--keygen-num-to-gen=10'
      restartPolicy: OnFailure
```

</details>

In reality, batch work is often done in **Parallel** or as part of a regularly occurring task.

**Parallel jobs**

Using Parallel jobs, we may be grabbing tasks from an ongoing queue or simply running a set number of tasks that are not dependent on each other. _In the case of jobs pulling from a queue_, our application must be aware of the dependencies and have the logic to decide how tasks are processed and what to work on next. Kubernetes is simply scheduling the jobs.

<details>
<summary>A one-shot Job example</summary>

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: parallel
  labels:
    chapter: jobs
spec:
  parallelism: 5
  completions: 10
  template:
    metadata:
      labels:
        chapter: jobs
    spec:
      containers:
        - name: oneshot
          image: docker/whalesay
          imagePullPolicy: Always
          args:
            - '--keygen-eanble'
            - '--keygen-exit-on-complete'
            - '--keygen-num-to-gen=10'
      restartPolicy: OnFailure
```

</details>

### CronJob

**Scheduled jobs**

Kubernetes has also released a **CronJob** type for tasks that need to run periodically.

ScheduledJobs build on top of the Job object by adding a schedule to a Job. A Sched uledJob contains the definition of the Job object that you want to create, as well as the schedule on which that Job should be created.

As we might expect, this type of job uses the underlying _cron formatting_ to specify a schedule for the task we wish to run

```yaml
# longtask in cron
apiVersion: batch/v2alpha1
kind: CronJob
metadata:
  name: long-task-cron
spec:
  schedule: '15 10 * * 5'
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: long-task
              image: docker/whalesay
              command: ['cowsay', 'Developers Task complete!']
          restartPolicy: OnFailure
# kubectl apply -f /path/to/longtask-cron.yaml
```

## DaemonSets

While ReplicaSets and Deployments are great at making sure that a specific number of application instances are running, they do so in the context of the best fit. _This means that the **scheduler looks for nodes that meet resource requirements** (available CPU, particular storage volumes, and so on) and tries to spread across the nodes and zones_.

**DaemonSet** simply defines a pod to run on **every single node** in the cluster or a defined subset of those nodes. This can be very useful for a number of production-related activities, such as monitoring and logging agents, security agents, and file system daemons.

> DaemonSets share similar functionality with ReplicaSets; both create Pods that are expected to be _long-running services_ and ensure that the desired state and the observed state of the cluster match.

ReplicaSets should be used when your application is completely decoupled from the node and you can run multiple copies on a given node without special consideration.

DaemonSets should be used when a single copy of your application must run on all or a subset of the nodes in the cluster.

<details>
<summary>Simple DaemonSet yaml listing.</summary>

```yaml
# DaemonSet, node problem detector
apiVersion: extensions/v1beta1
kind: DaemonSet
metadata:
  name: node-problem-detector-v1
  namespace: kube-system
  labels:
    k8s-app: node-problem-detector
    version: v1
    kubernetes.io/cluster-service: 'true'
spec:
  template:
    metadata:
      labels:
        k8s-app: node-problem-detector
        version: v1
        kubernetes.io/cluster-service: 'true'
    spec:
      hostNetwork: true
      containers:
        - name: node-problem-detector
          image: node-problem-detector:v1
          securityContext:
            privileged: true
          resources:
            limits:
              cpu: '200m'
              memory: '100Mi'
            requests:
              cpu: '20m'
              memory: '20Mi'
          volumeMounts:
            - name: log
              mountPath: /log
              readOnly: true
      volumes:
        - name: log
          hostPath:
            path: /var/log/
```

```yaml
apiVersion: extensions/v1beta1
kind: DaemonSet
metadata:
  # unique name across DaemonSets
  name: fluentd
  labels:
    app: fluentd
spec:
  template:
    metadata:
      labels:
        app: fluentd
    spec:
      containers:
        - name: fluentd
          image: fluent/fluentd:v0.14.10
          resources:
            limits:
              memory: '200Mi'
            requests:
              cpu: '100m'
              memory: '200Mi'
          volumeMounts:
            - name: varlog
              mountPath: /var/log
            - name: var_lib_docker_containers
              mountPath: /var/lib/docker/containers
              readOnly: true
      terminationGracePeriodSeconds: 30
      volumes:
        - name: varlog
          hostPath:
            path: /var/log
        - name: var_lib_docker_containers
          hostPath:
            path: /var/lib/docker/containers
```

</detais>

<details>
<summary>

> You can use labels to run DaemonSet Pods on specific nodes.

</summary>

```bash
# add label to node
# daemonset would find this using nodeSelector
kubectl label node <node-name> ssd=true
```

```yaml
apiVersion: extensions/v1beta1
kind: DaemonSet
metadat:
  labels:
    app: nginx
    ssd: 'true'
  name: nginx-fast-storage
spec:
  template:
    metadata:
      labels: nginx
      ssd: 'true'
    spec:
      nodeSelector:
        ssd: 'true'
      containers:
        - name: nginx
          image: nginx:1.10.0
```

</details>

### Updating DaemonSet

With the release of Kubernetes 1.6, DaemonSets gained an equivalent to the _Deployment object_ that manages a DaemonSet rollout inside the cluster.

`spec.updateStrategy.type`: `RollingUpdate`

`spec.minReadySeconds`: determines how long a Pod must be “ready” before the rolling update proceeds to upgrade subsequent Pods.

`spec.updateStrategy.rollingUpdate.maxUnavailable`: indicates how many Pods may be simultaneously updated by the rolling update.

> The DaemonSet provides its own controller and scheduler to ensure key services like monitoring agents are always up and running on the right nodes in your cluster.

## Node Selection

In order to schedule DaemonSets to run on a subset of nodes, we need the help of **nodeSelector**.

It allows us to constrain the nodes a pods runs on, by looking for specific lables and metadata. They simple match key-value pairs on the labels for each node.

Actually, nodeSelectors work with Pod definitions as well.

```bash
# label some node
kubectl label nodes <node-name> <label-key>=<label-value>
```

```yaml
# longtask Job with nodeSelector
apiVersion: batch/v1
kind: Job
metadata:
  name: long-task-ns
spec:
  template:
    metadata:
      name: long-task-ns
    spec:
      containers:
        - name: long-task-ns
          image: docker/whalesay
          command: ['cowsay', 'Finishing that task in a jiffy']
      restartPolicy: OnFailure
      nodeSelector:
        <label-key>: <label-value>
```
