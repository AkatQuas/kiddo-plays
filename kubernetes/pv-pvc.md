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
```

```yaml
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

<details>
<summary>

A small exmaple to use PV and PVC.

</summary>

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: database
  labels:
    volume: my-volume
spec:
  accessModes:
    - ReadWriteMany
  capacity:
    storage: 1Gi
  nfs:
    server: 192.168.0.1
    path: '/exports'
```

```yaml
# this request "1Gi" of storage in "ReadWriteOnce" mode
# with a StorageClass of "solidstate" and label of "aws-storage".
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: demo-claim
  annotations:
    volume.beta.kubernetes.io/storage-class: 'solidstate'
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 1Gi
  selector:
    matchLabels:
      release: 'aws-storage'
      volume: my-volume
```

```yaml
# using PVC in ReplicaSets
apiVersion: extensions/v1
kind: ReplicaSet
metadata:
  name: mysql
  labels:
    app: mysql
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    sepc:
      containers:
        - name: database
          image: mysql
          resources:
            requests:
              cpu: 1
              memory: 2Gi
          env:
            - name: MYSQL_ROOT_PASSWORD
              value: some-password
          livenessProbe:
            tcpSocket:
              port: 3306
          ports:
            - containerPort: 3306
          volumeMounts:
            - name: database
              mountPath: '/var/lib/mysql'
      volumes:
        - name: database
          persistentVolumeClaim:
            claimName: demo-claim
```

```yaml
# expose mysql ReplicaSet as a Service
apiVersion: v1
kind: Service
metadata:
  name: mysql
spec:
  ports:
    - port: 3306
      protocol: TCP
  selector:
    app: mysql
```

</details>

Kubernetes provides two other methods for specifying certain groupings or types of storage volumes:

- selectors: labels can be applied to storage volumes and then claims can reference these labels to further filter the volume they are provided.

- StorageClass: it allows us to specify a storage provisioner and parameters for the type of volumes it provisions.

**Dynamic Volume Provisioning**

Many clusters also include _dynamic volume provisioning_. With dynamic volume provisioning, the cluster operator creates one or more `StorageClass` objects.

```yaml
# a default storage class that automatically
# provisions disk objects on the Microsoft Azure platform.
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: default
  annotations:
    storageclass.beta.kubernetes.io/is-default-class: 'true'
  labels:
    kubernetes.io/cluster-service: 'true'
provisioner: kubernetes.io/azure-disk
```

Once a storage class has been created for a cluster, you can refer to this storage class in your persistent volume claim, rather than referring to any specific persistent volume.

When the dynamic provisioner sees this storage claim, it uses the appropriate volume driver to create the volume and bind it to your persistent volume claim.

<details>

<summary>

An example of a `PersistentVolumeClaim` that uses the default storage class to claim a newly created persistent volume.

</summary>

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-claim
  annotations:
    # this links the claim back up to the storage class
    volume.beta.kubernetes.io/storage-class: default
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

</details>

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
apiVersion: apps/v1
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

<details>
<summary>

Stateful Mongo Pods, automated initialization.

</summary>

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongo
spec:
  serviceName: 'mongo'
  replicas: 3
  template:
    metadata:
      labels:
        app: mongo
    spec:
      containers:
        - name: mongodb
          image: mongodb:3.4.1
          command:
            - mongod
            - --replSet
            - rs0
          ports:
            - containerPort: 27017
              name: peer
```

Once the StatefulSet is created, we also need to create a “headless” service to manage the DNS entries for the StatefulSet. In Kubernetes a service is called “headless” if it doesn’t have a cluster virtual IP address. Since with StatefulSets each Pod has a unique identity, it doesn’t really make sense to have a load-balancing IP address for the replicated service. You can create a headless service using `clusterIP: None` in the service specification

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mongo
spec:
  ports:
    - port: 27017
      name: peer
  clusterIP: None
  selector:
    app: mongo
```

Once you create that service, there are usually four DNS entries that are populated. As usual, `mongo.default.svc.cluster.local` is created, but unlike with a standard service, doing a DNS lookup on this hostname provides all the addresses in the StatefulSet. In addition, entries are created for `mongo-0.mongo.default.svc.cluster.local` as well as `mongo-1.mongo` and `mongo-2.mongo`. Each of these resolves to the specific IP address of the replica index in the StatefulSet.

We’ll choose `mongo-0.mongo` to be our initial primary. Run the `mongo` tool in that Pod:

```bash
kubectl exec -it mongo-0 mongo

# primary replica
> rs.initiate( {
    _id: "rs0",
    members:[ { _id: 0, host: "mongo-0.mongo:27017" } ] });
# OK

# adding the remaining replicas
> rs.add("mongo-1.mongo:27017");
> rs.add("mongo-2.mongo:27017");
```

However, we can automate the deployment of adding shards in the MongoDB by using an additional container in the Pods manifest to perform the initialization.

```yaml
# refine the previous mongodb Pod manifest
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongo
spec:
  serviceName: 'mongo'
  replicas: 3
  template:
    metadata:
      labels:
        app: mongo
    spec:
      containers:
        - name: mongodb
          image: mongodb:3.4.1
          command:
            - mongod
            - --replSet
            - rs0
          ports:
            - containerPort: 27017
              name: web
        - name: init-mongo
          image: mongo:3.4.1
          command:
            - bash
            - /config/init.sh
          volumeMounts:
            - name: config
              mountPath: /config
      volumes:
        - name: config
          configMap:
            name: 'mongo-init'
```

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mongo-init
data:
  init.sh: |
    #! /bin/bash

    # Need to wait for the readiness health check to pass so that the
    # mongo names resolve. This is kind of wonky.
    until ping -c 1 ${HOSTNAME}.mongo; do
      echo "waiting for DNS (${HOSTNAME}.mongo)..."
      sleep 2
    done

    until /usr/bin/mongo --eval 'printjson(db.serverStatus())'; do
      echo "connecting to local mongo..."
      sleep 2
    done
    echo "connected to local."

    HOST=mongo-0.mongo.27017

    until /usr/bin/mongo --host=${HOST} --eval 'printjson(db.serverStatus())'; do
      echo "connecting to remote mongo..."
      sleep 2
    done
    echo "connected to remone."

    if [[ "${HOSTNAME}" != 'mongo-0' ]]; then
      until /usr/bin/mongo --host=${HOST} --eval="printjson(rs.status())" \
            | grep -v "no replset config has been received"; do
        echo "waiting for replication set initialization"
        sleep 2
      done

      echo "adding self ${HOSTNAME} to ${HOST}"
      /usr/bin/mongo --host=${HOST} \
          --eval="printjson(rs.add('${HOSTNAME}.mongo'))"
    fi

    if [[ "${HOSTNAME}" == 'mongo-0' ]]; then
      echo "initializing replica set"
      /usr/bin/mongo --eval="printjson(rs.initiate(\
        {'_id':'rs0', 'members': [{ '_id': 0, \
         'host': 'mongo-0.mongo:27017' }]}))"
    fi
    echo "initialized"

    while true; do
      sleep 3600
    done
```

> This script (`init.sh`) currently sleeps forever after initializing the cluster. Every container in a Pod has to have the same RestartPolicy. Since we do not want our main Mongo container to be restarted, we need to have our initialization container run forever too, or else Kubernetes might think our Mongo Pod is unhealthy.

```bash
kubectl apply -f mongo-config-map.yaml
kubectl apply -f mongo-service.yaml
kubectl apply -f mongo.yaml
```

</details>

<details>
<summary>Readiness Probe</summary>
Add liveness checks to the StatefulSet object

```yaml
# ...
livenessProbe:
  exec:
    command:
      - /usr/bin/mongo
      - --eval
      - db.serverStatus()
  initialDelaySeconds: 10
  timeoutSeconds: 10
# ...
```

</details>

## Persistent Volumes and StatefulSets

For persistent storage, you need to mount a persistent volume into the `/data/db` directory. In the Pod template, you need to update it to mount a persistent volume claim to that directory:

```yaml
# ...
volumeMounts:
  - name: database
    mountPath: /data/db
```

While this approach is similar to the one we saw with reliable singletons, because the StatefulSet replicates more than one Pod you cannot simply reference a persistent volume claim. Instead, you need to add a _persistent volume claim template_.

You need to add the following onto the bottom of your StatefulSet definition:

```yaml
volumeClaimTemplates:
  - metadata:
    name: database
    annotations:
      volume.alpha.kubernetes.io/storage-class: anything
    spec:
      accessModes: ['ReadWriteOnce']
      resources:
        requests:
          storage: 100Gi
```

When you add a volume claim template to a StatefulSet definition, each time the StatefulSet controller creates a Pod that is part of the StatefulSet it will create a persistent volume claim based on this template as part of that Pod.
