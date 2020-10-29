[Back to Top](./README.md)

# Deployments, Jobs, and DaemonSets

Kubernetes supports various types of workloads:

- Deployments: regularly updated and long running applications
- Jobs: short-running tasks
- DaemonSets: programs to be run every node

## Deployments

Although `ReplicaSets` are the primitive for running many different copies of the same container image, applications are not static entities. They evolve as developers add new features and fix bugs. This means that the act of rolling out new code to a Service is as important a feature as replicating it to reliably handle load.

The `Deployment` object was added to the Kubernetes API to represent this sort of _safe rollout_ from one version to another. A Deployment can hold pointers to multiple ReplicaSets, (e.g. v1 and v2), and it can control the slow and safe migration from one ReplicaSet to another.

Deployments allow us to pause and resume application rollouts. Additionally, it keeps a history of past deployments and allows the user to easily rollback to previous versions.

> Deployments feature a large number of different knobs that can be tuned to provide a safe rollout for the specific details of an application. Indeed, in most modern clusters, users exclusively use Deploy ment objects and don’t manage ReplicaSets directly.

```yaml
apiVersion: v1
kind: Deployment
metadata:
  name: node-js-deploy
  labels:
    name: node-js-deploy
spec:
  replicas: 1
  template:
    metadata:
      labels:
        name: node-js-deploy
    spec:
      containers:
        - name: node-js-deploy
          image: pod-scaling
          ports:
            - containerPort: 80

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

> `Recreate` will kill the old pods first before creating the new versions.
>
> `RollingUpdate` will create new pods to replace the old pods.

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

## Jobs

Sometimes, we need the tasks to run until completion, but then terminate and start again at the next scheduled interval.

Kubernetes has added a _Batch API_, which includes the **Job** type. This type will create 1 to n pods and ensure that they all run to completion with a successful exit.

A Job contains the definition of the Pods it creates, the number of times the Job should be run, and the maximum number of Pods to create in parallel.

Based on `restartPolicy`, we can either allow pods to simply fail without retry (`restartPolicy: Never`) or retry when a pods exits without successful completion (`restartPolicy: OnFailure`).

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

In reality, batch work is often done in **Parallel** or as part of a regularly occurring task.

**Parallel jobs**

Using Parallel jobs, we may be grabbing tasks from an ongoing queue or simply running a set number of tasks that are not dependent on each other. _In the case of jobs pulling from a queue_, our application must be aware of the dependencies and have the logic to decide how tasks are processed and what to work on next. Kubernetes is simply scheduling the jobs.

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

While Replication Controllers and Deployments are great at making sure that a specific number of application instances are running, they do so in the context of the best fit. _This means that the **scheduler looks for nodes that meet resource requirements** (available CPU, particular storage volumes, and so on) and tries to spread across the nodes and zones_.

**DaemonSet** simply defines a pod to run on **every single node** in the cluster or a defined subset of those nodes. This can be very useful for a number of production-related activities, such as monitoring and logging agents, security agents, and file system daemons.

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
