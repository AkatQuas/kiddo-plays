[Back to Top](./README.md)

# Storage and Running Stateful Applications

## Volume

`Volume` in this chapter is actually a part of the Pod API. Within a Pod, you can define a set of Volumes. Each Volume can be one of a large number of different types.

When you add a Volume to your Pod, you can choose to mount it to an arbitrary location in each running container. This enables your running container to have access to the storage within the Volume. Different containers can mount these Volumes at different locations or can ignore the Volume entirely.

## ConfiMap

In addition to basic files, there are several types of Kubernetes objects that can themselves be mounted into your Pod as a Volume.

A `ConfigMap` represents a collection of configuration files. In Kubernetes, you want to have different configurations for the same container image. When you add a ConfigMap-based Volume to your Pod, the files in the ConfigMap show up in the specified directory in your running container.

Kubernetes uses the Secret configuration type for secure data, such as database passwords and certificates. In the context of Volumes, a Secret works identically to a Con figMap. It can be attached to a Pod via a Volume and mounted into a running container for use.

---

Instead of binding a Volume directly into a Pod, a `PersistentVolume` is created as a separate object. This object is then claimed to a specific Pod by a `PersistentVolumeClaim` and finally mounted into the Pod via this claim.

## Persistent storage

Real-world applications often carry state and record data that we prefer (even insist) not to lose.

A **volume** that exists outside the container allows us to save our important data across containers outages. Further, if we have a volume at the pod level, data can be shared between containers in the same application stack and within the same pod.

Additionally, a pod can have multiple volumes from a variety of sources.

**Temporary disk**

One of the easiest ways to achieve improved persistence amid container crashes and data sharing within a pod is to use the `emptydir` volume. This volume type can be used with either the storage volumes of the node machine itself or an optional RAM disk for higher performance.

Again, we improve our persistence beyond a single container, but when a pod is removed, the data will be lost. Also, Machine reboot will also clear any data from RAM-type disks. There may be times when we just need some shared temporary space or have containers that process data and hand it off to another container before they die.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: memory-pd
spec:
  containers:
    - image: nginx:latest
      ports:
        - containerPort: 80
      name: memory-pd
      volumeMounts:
        - mountPath: /memory-pd
          name: memory-volume
  volumes:
    - name: memory-volume
      emptyDir:
        medium: Memory
# this folder is quite temporary as
# everything is stored in the node's (minion's) RAM.
# When the node gets restarted, all the files will be erased.
```

**Cloud volumes**

<details>
<summary>

Create some Persistent Disks in GCE in advance.

</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-gce
spec:
  containers:
    - image: nginx:latest
      ports:
        - containerPort: 80
      name: test-gce
      volumeMounts:
        - mountPath: /usr/share/nginx/html
          name: gce-pd
  volumes:
    - name: gce-pd
      gcePersistentDisk:
        pdName: mysite-volume-1
        fsType: ext4
```

```yaml
apiVersion: v1
kind: ReplicationController
metadata:
  name: http-pd
  labels:
    name: http-pd
spec:
  replicas: 3
  selector:
    name: http-pd
  template:
    metadata:
      name: http-pd
      labels:
        name: http-pd
    spec:
      containers:
        - image: nginx:latest
          ports:
            - containerPort: 80
          name: http-pd
          volumeMounts:
            - mountPath: /usr/share/nginx/html
              name: gce-pd
      volumes:
        - name: gce-pd
          gcePersistentDisk:
            pdName: mysite-volume-1
            fsType: ext4
            readOnly: true

apiVersion: v1
kind: Service
metadata:
  name: http-pd
  labels:
    name: http-pd
spec:
  type: LoadBalancer
  ports:
    - name: http
      protocol: TCP
      port: 80
  selector:
    name: http-pd
```

</details>

## PersistentVolumes and StorageClasses

We need some way for the application to specify and request storage without being concerned with how that storage is provided.

`PersistentVolumes` are similar to `volumes` we created earlier, but they are provided by the cluster administer and are not dependent on a particular pod. This volume can then be claimed by pods using `PersistentVolumeClaims`.

`PersistentVolumeClaims` allows us to specify the details of the storage needed. We can defined the amount of storage as well as the access type such as `ReadWriteOnce` (read and write by one node), `ReadOnlyMany` (read-only by multiple nodes), and `ReadWriteMany` (read and write by many nodes).

Kubernetes provides two other methods for specifying certain groupings or types of storage volumes:

- selectors: labels can be applied to storage volumes and then claims can reference these labels to further filter the volume they are provided.

- StorageClass: it allows us to specify a storage provisioner and parameters for the type of volumes it provisions.

```yaml
# this request "1Gi" of storage in "ReadWriteOnce" mode
# with a StorageClass of "solidstate" and label of "aws-storage".
apiVersion: v1
kind: PersistentVolumeClain
metadata:
  name: demo-claim
  annotations:
    volume.beta.kubernetes.io/storage-class: 'solidstate'
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  selector:
    matchLabels:
      release: 'aws-storage'
```

## StatefulSets

However, some applications, especially stateful storage workloads or sharded applications, require more differentiation between the replicas in the application.

The purpose of **StatefulSets** is to provide some consistency and predictability to application deployments with stateful data.

In a ReplicaSet, each replicated Pod receives a name that involves a random hash (e.g., frontend-14a2), and there is no notion of ordering in a ReplicaSet. In contrast, with StatefulSets, each replica receives a monotonically increasing index (e.g., backend-0, backend-1, and so on).

Further, StatefulSets guarantee that replica zero will be created and become healthy before replica one is created and so forth.

StatefulSets receive DNS names so that each replica can be accessed directly, in addition to the complete StatefulSet. This allows clients to easily target specific shards in a sharded service.

> This means that a Statefulset called db with 3 replicas will create the following pods:
>
>     db-0
>     db-1
>     db-2

<details>
<summary>

A stateful example

</summary>

```yaml
# a StorageClass kind of SSD dirves in sea-central1-c
apiVersion: storage.k8s.io/v1beta1
kind: StorageClass
metadata:
  name: solidstate
provisioner: kubernetes.io/gce-pd
parameters:
  type: pd-ssd
  zone: sea-central1-c

# a StatefulSet with storage claims
apiVersion: apps/v1beta1
kind: StatefulSet
metadata:
  name: whaleset
spec:
  serviceName: sayhey-svc
  replicas: 3
  template:
    metadata:
      labels:
        app: sayhey
    spec:
      terminationGracePeriodSeconds: 10
      containers:
        - name: sayhey
          image: httpwhalesay:0.2
          command: ["node", "index.js", "Whale it up!"]
          ports:
            - containerPort: 80
              name: web
          volumeMounts:
            - name: www
              mountPath: /usr/share/nginx/html
  volumeClaimTemplates:
    - metadata:
        name:         www
        annotations:
          volume.beta.kubernetes.io/storage-class: solidstate
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 1Gi

# service endpoint
apiVersion: v1
kind: Service
metadata:
  name: sayhey-svc
  labels:
    app: sayhey
spec:
  ports:
    - port: 80
      name: web
  clusterIP: None
  selector:
    app: sayhey
```

Using `kubectl get pv` to show the PersistentVolumes.

`kubectl get pvc` to show the PersistentVolumesClaims.

</details>
