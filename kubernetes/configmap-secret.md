[Back to Top](./README.md)

**ConfigMap and Secret key examples**

| Valid key name | Invalid key name  |
| -------------- | ----------------- |
| .auth_token    | Token..properties |
| Key.pem        | auth\ file.json   |
| config_file    | \_password.txt    |

ConfigMap data values are simple UTF-8 text specified directly in the manifest. As of Kubernetes 1.6, ConfigMaps are unable to store binary data.

Secret data values hold arbitrary data encoded using base64. The use of base64 encoding makes it possible to store binary data. This does, however, make it more difficult to manage secrets that are stored in YAML files as the base64-encoded value must be put in the YAML. Note that the maximum size for a ConfigMap or secret is 1 MB.

## ConfigMaps

[Kubernetes ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/).

ConfigMaps are used to provide configuration information for workloads.

The key thing is that the ConfigMap is combined with the Pod right before it is run.

**Create ConfigMap**

From command line:

```bash
cat my-config.txt

# This is a sample config file that I might use to configure an application
parameter1 = value1
parameter2 = value2


kubectl create configmap my-config \
  --from-file=my-config.txt \
  --from-literal=extra-param=extra-value \
  --from-literal=another-param=another-value
```

Using manifest yaml file:

```yaml
apiVersion: v1
data:
  another-param: another-value
  extra-param: extra-value
  my-config.txt: |
    # This is a sample config file that I might use to configure an application
    parameter1 = value1
    parameter2 = value2
kind: ConfigMap
metadata:
  creationTimestamp: null
  name: my-config
  namespace: default
  resourceVersion: '13556'
  selfLink: /api/v1/namespaces/default/configmaps/my-config
  uid: <configmap-uid>
```

**Using a ConfigMap**

A configMap volume!

- Filesystem

  Mount a Configmap into a Pod. A file is created for each entry based on the key name. The contents of that file are set to the value.

- Environment variable

  Set the value of an environment variable dynamically.

- Command-line argument

  Create the command line for a container based on ConfigMap values dynamically.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: kuard-config
spec:
  containers:
    - name: config-in-file
      image: test-image
      imagePullPolicy: Always
      # command line arguments built upon enviroment variables
      command:
        - '/node'
        - '$(EXTRA_PARAM)'
      env:
        # read value from configMap
        - name: ANOTHER_PARAM
          valueFrom:
            configMapKeyRef:
              name: my-config
              key: another-param
        # read value from configMap
        - name: EXTRA_PARAM
          valueFrom:
            configMapKeyRef:
              name: my-config
              key: extra-param
      volumeMounts:
        # mount the configMap volume to container
        - name: config-volume
          mountPath: /config
  volumes:
    # this is a configMap volume
    - name: config-volume
      configMap:
        name: my-config
  restartPolicy: Never
```

## Sercets

[Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/).

Secrets are similar to ConfigMaps but focused on making sensitive information available to the workload.

> By default, Kubernetes secrets are stored in plain text in the `etcd` storage for the cluster.

**Create Secrets**

From command line:

```bash
kubectl create secret generic kuber-tls \
  --from-file=kuber.crt \
  --from-file=kuber.key
```

Using manifest yaml file:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: kuber-tls
type: kubernetes.io/tls
data:
  # the data is abbreviated in this example
  kuber.crt: |
    MIIC2DCCAcCgAwIBAgIBATANBgkqh ...
  kuber.key: |
    MIIEpgIBAAKCAQEA7yn3bRHQ5FHMQ ...
```

<details>
<summary>
</summary>

```bash
$ kubectl create secret docker-registry my-image-pull-secret \
  --docker-username=<username> \
  --docker-password=<password> \
  --docker-email=<email-address>
```

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: docker-registry
type: Opaque
stringData:
  docker-username: <username>
  docker-password: <password>
  docker-email: <email-address>
```

</details>

**Consuming Secrets**

A secrets volume!

Secrets volumes are managed by the kubelet and are created at Pod creation time. Secrets are stored on tmpfs volumes (aka RAM disks), and as such are not written to disk on nodes.

Each data element of a secret is stored in a separate file under the target mount point specified in the volume mount.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: kuber-tls
spec:
  containers:
    - name: kuber-tls
      image: kuber-image
      volumeMounts:
        - name: tls-cert
          mountPath: '/tls'
          readOnly: true
  volumes:
    - name: tls-certs
      secret:
        secretName: kuber-tls
```

Mounting the kuard-tls secrets volume to `/tls` results in the following files:

    /tls/kuard.crt
    /tls/kuard.key

---

**Creating**

The easiest way to create a secret or a ConfigMap is via `kubectl create secret generic` or `kubectl create configmap`. There are a variety of ways to specify the data items that go into the secret or ConfigMap. These can be combined in a single command:

```bash
# Load from the file with the secret data key the same as the filename.
--from-file=<filename>

# Load from the file with the secret data key explicitly specified.
--from-file=<key>=<filename>

# Load all the files in the specified directory where the filename is an acceptable key name.
--from-file=<directory>

# Use the specified key/value pair directly.
--from-literal=<key>=<value>
```

`kubectl edit configmap my-config`
