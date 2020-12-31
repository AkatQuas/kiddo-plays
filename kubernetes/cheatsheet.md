[Back to Top](./README.md)

```bash
kubectl <action> <resource> <object> [options]
```

# Cheatsheet for Kubernetes

- Install Docker and the core Kubernetes

      apt-get install -y docker.io

      apt-get install -y kubelet kubeadm kubectl kubernetes-cni

- Master initialization. Use `kubeadm reset` if problems occurr.

      kubeadm init

- Joining nodes

      kubeadm join --token=<some token> <master node ip address>

- Config UI

      kubectl config view

- Display information

      kubectl cluster-info

- List nodes in the cluster

      kubectl get nodes

      kubectl get rc -l deployment=test

- List cluster events

      kubectl get events

- List services running in the cluster

      kubectl get services

      kubectl get services -l "name in (node-js,node-js-labels)"

- List pods running on all the minions

      kubectl get pods

      kubectl get pods --namespace=kube-system

- Apply kubernetes components

      kubectl apply -f <some component yaml file>

- Create a pod using pod-configuration-yaml

      kubectl applay -f <some pod configuration yaml file>

      kubectl describe pods/<pods-name>

- Coping Files to and from Containers

      kubectl cp <pod-name>:/path/to/file /host/path/to/file

      kubectl cp /host/path/to/file <pod-name>:/path/to/file
