[Back to Top](./README.md)

# Updates, Gradual Rollouts, AutoScaling

Deployments are the recommended way to deal with scaling and application updates going forward.

```bash
kubectl get pods -l name=<pod-name>
kubectl scale --replicas=3 rc/<pod-name>
```

The `rolling-update` command allows us to update entire RCs or just the underlying Docker image used by each replica.

We can also specify an update interval, which will allow us to update one pod at a time and wait until proceeding to the next.

```bash
kubectl rolling-update <pod-name> [<new-pod-name>] [OPTION] --update-period="2m"
```

<details>
<summary>

A/B test configuration example

</summary>

```yaml
# pod-AB-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: node-js-scale-ab
  labels:
    service: node-js-scale-ab
spec:
  type: LoadBalancer
  ports:
    - port: 80
  sessionAffinity: ClientIP # session affinity to service and node
  selector:
    service: node-js-scale-ab

#  pod-A-controller.yaml
apiVersion: v1
kind: ReplicationController
metadata:
  name: node-js-scale-a
  labels:
    name: node-js-scale-a
    version: '0.2'
    service: node-js-scale-ab
spec:
  replicas: 2
  selector:
    name: node-js-scale-a
    version: '0.2'
    service: node-js-scale-ab
  template:
    metadata:
      labels:
        name: node-js-scale-a
        version: '0.2'
        service: node-js-scale-ab
    spec:
      containers:
        - name: node-js-scale
          image: pod-scaling:0.2
          ports:
            - containerPort: 80
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 30
            timeoutSeconds: 5
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 30
            timeoutSeconds: 1

#  pod-A-controller.yaml
apiVersion: v1
kind: ReplicationController
metadata:
  name: node-js-scale-b
  labels:
    name: node-js-scale-b
    version: '0.3'
    service: node-js-scale-ab
spec:
  replicas: 2
  selector:
    name: node-js-scale-b
    version: '0.3'
    service: node-js-scale-ab
  template:
    metadata:
      labels:
        name: node-js-scale-b
        version: '0.3'
        service: node-js-scale-ab
    spec:
      containers:
        - name: node-js-scale
          image: pod-scaling:0.3
          ports:
            - containerPort: 80
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 30
            timeoutSeconds: 5
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 30
            timeoutSeconds: 1

```

In a true A/B test, we would now want to start collecting metrics on the visit to each version. Again, we have `sessionAffinity` set to ClientIP, so all requests will go to the same pod.

Since the versions are each on their own pod, one can easily separate logging and even add a logging container to the pod definition for a sidecar logging pattern.

```bash
# finish the A/B test, transition to version 0.3
kubectl scale --replicas=3 rc/node-js-scale-b
kubectl scale --replicas=1 rc/node-js-scale-a
kubectl scale --replicas=4 rc/node-js-scale-b
kubectl scale --replicas=0 rc/node-js-scale-a

# remove the controller
kubectl delete rc/node-js-scale-a
```

</details>

## Application autoscaling

> Kubernetes makes a distinction between _horizontal scaling_, which involves creating additional replicas of a Pod, and _vertical scaling_, which involves increasing the resources required for a particular Pod (e.g., increasing the CPU required for the Pod).

**Horizontal Pod Autoscaler**: This resource type is really useful as it gives us a way to automatically set thresholds (CPU/QPS/Memory) for scaling our application.

```yaml
# HPA configurations
apiVersion: v1
kind: HorizontalPodAutoscaler
metadata:
  name: node-js-scale-ab
spec:
  minReplicas: 1
  maxReplicas: 3
  scaleTargetRef:
    apiVersion: v1
    kind: ReplicationController
    name: node-js-scale
  targetCPUUtilizationPercentage: 20
```

```bash
kubectl get hpa
```

```yaml
# generate soom load to the service
apiVersion: v1
kind: ReplicationController
metadata:
  name: boomload
spec:
  replicas: 1
  selector:
    app: loadgenerator
  template:
    metadata:
      labels:
        app: loadgenerator
    spec:
      containers:
        - name: boom
          image: williamyeh/boom
          command: ['/bin/sh', '-c']
          args:
            [
              'while true; do boom http://node-js-scale/ -c 10 -n 100; sleep 1; done',
            ]
```

### Scaling a cluster

Additionally, we need some autoscaling capability in the clusters other than appliactions.

The following example shows how to set the environment variables for autoscaling before running `kube-up.sh`:

```bash
export NUM_MINIONS=5
export KUBE_AUTOSCALER_MIN_NODES=2
export KUBE_AUTOSCALER_MAX_NODES=5
export KUBE_ENABLE_CLUSTER_AUTOSCALER=true
```

Once you start a cluster with these settings, your cluster will automatically scale up and down with the minimum and maximum limits based on compute resource usage in the cluster.
