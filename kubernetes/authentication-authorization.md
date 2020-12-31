[Back to Top](./README.md)

# Authentication, User Management, Authorization and Adimission Control

As with any multitenant, distributed system, user management forms the basis for how Kubernetes ultimately authenticates identities, determines appropriate levels of access, enables self-service capabilities, and maintains auditability.

Before the server will accept (and subsequently act) on the request. Each of these tests falls into one of three groups: authentication, access control, and admission control.

## User

Every request that comes to Kubernetes is associated with some identity. Even a request with no identity is associated with the `system:unauthenticated` group.

The term `users` pertains to how you and I (and maybe even your continuous delivery tooling) connect and gain access to the Kubernetes API.

There are many kinds of access to the Kubernetes API:

- `kubectl` command-line interface
- custom scripts
- static token files on the host
- controllers
- the web user interface
- authentication webhooks

The users are not a top-level supported resource, which are not manipulated directly by way of the Kubernetes API, but are defined in an external user identity management system.

There is good reason for this—it stands in support of good user management hygiene.

How you manage your users should remain consistent across your organization, regardless of the systems consuming it. Kubernetes supports this design tenet by providing the connectivity to leverage these existing systems, thus enabling consistent and effective user management across your infrastructure.

## Authentication

The absence of such systems does not mean that you won’t be able to use Kubernetes. It may just mean that you may need to leverage a different mechanism for authenticating users.

Just as with many well-designed REST-based APIs, there are multiple strategies that Kubernetes can employ for authenticating users. We can think about each of these strategies as belonging to one of three major groups:

- Basic Authentication
- X.509 client certificates
- Bearer tokens

### kubeconfig

We need to craft a kubeconfig file that records the details of how we authenticate.

`kubectl` uses this configuration file to determine where and how to issue requests to the API server. This file is typically located in your home directory under `~/.kube/config` but may also be specified explicitly on the command line with the `--kubeconfig` parameter or by way of the `KUBECONFIG` environment variable.

For someone who may not be familiar with a `kubeconfig` file, it is important to understand its three top-level structures: `users`, `clusters`, and `contexts`. With `users` we name a user and provide the mechanism by which he or she will authenticate to a cluster. The `clusters` attribute provides all of the data necessary to connect to a cluster. This, minimally, includes the IP or fully qualified domain name for the API server but may also include items like the CA bundle for a _self-signed certificate_. And `contexts` is where we associate users with clusters as a single named entity. The `context` serves as the means by which `kubectl` connects and authenticates to an API server.

### Service Accounts

There is another important use case to consider though, and this pertains to how the processes running inside a Pod access the API.

A Kubernetes cluster is a state machine made up of a collection of controllers. Each of these controllers is responsible for reconciling the state of the user-specified resources.

The way that Kubernetes handles these use cases is using the ServiceAccount resource:

```bash
kubectl create sa testsa
kubectl get sa testsa -o yaml
```

In the output above, note that when we created the `ServiceAccount`, a Secret named `testsa-token-<hash>` was also created automatically. Just as with the end-user authentication we discussed earlier, this is the token that will be included as a bearer token on every API request. These credentials are mounted into the Pod in a well-known location that is accessible by the various Kubernetes clients.

```bash
# kubectl exec into some pod
ls -al /var/run/secrets
ls -al /var/run/secrets/kubernetes.io/serviceaccount
```

Every Pod that is launched could have an associated `ServiceAccount`.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: testpod
spec:
  serviceAccountName: testpod-sa
```

If none is specified in the Pod manifest, a default `ServiceAccount` is used. This default `ServiceAccount` is available on a namespace-wide basis and is automatically created when a namespace is.

Authentication is only the first challenge for a Kubernetes API request. There are two additional tests for every request: access control and admission control.

## REST

The Kubernetes API is a RESTful API. The advantageous properties of a RESTful APIs are many (e.g., scalability and portability), but its simple structure is what enables us to determine levels of access within Kubernetes.

```bash
kubectl -v=6 get pod <somepod>
```

Just as with HTTP, these four verbs constitute the most basic elements of how we would interact with Kubernetes resources.

Within the Kubernetes API, in addition to `get`, `update`, `delete`, and `patch`, we also have access to the verbs `list`, `watch`, `proxy`, `redirect`, and `deletecollection`, when dealing with resources.

## Authorization

Just because users are authenticated does not mean that we should give equal access rights to all of them.

Just as with authentication, authorization is the responsibility of the API server. The API server may be configured to implement various authorization modules using the aptly named `--authorization-mode` argument to the `kube-apiserver` executable.

The API server passes each request to these modules in the order defined by the comma-delimited `--authorization-mode` argument. Each module, in turn, may either weigh in on the decision-making process or choose to abstain.

In the case of abstinence, the API request simply moves on to the next module for evaluation. If, however, a module does make a decision, the authorization is terminated and reflects the decision of the authorizing module. If the module denies the request, the user receives an appropriate HTTP 403 (Forbidden) response, and if the request is allowed, the request makes its way to the final step of API flow: admission controller evaluation.

### Role-Based Access Control

The RBAC module, shorted for role-based access control, allows for the implementation of _dynamic access control_ polices at runtime.

Put succinctly, Kubernetes maps the attributes of the `UserInfo` object to the resources and verbs that the user should have access to.

A _role_ is a set of abstract capabilities.

A _role binding_ is an assignment of a role to one or more identities.

> For example, the _appdev_ role might represent the ability to create Pods and services. Thus, binding the _appdev_ role to the user identity _alice_ indicates that Alice has the ability to create Pods and services.

**Role and ClusterRole**

With the RBAC module, authorization to perform an action on a resource is defined with the `Role` or `ClusterRole` resource types.

An implementation of the the example, where a user has read-write access to `Deployments` but only read access to `Pods`) might look something like this:

```yaml
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: web-rw-deployment
  namespace: some-web-app-ns
rules:
  - apiGroups: ['']
    resources: ['pods']
    verbs: ['get', 'list', 'watch']
  - apiGroups: ['extensions', 'apps']
    resources: ['deployments']
    verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete']
```

The `apiGroups` field of each rule simply indicates to the API server the namespace of the API that it should act on. (This reflects the API namespace defined in the `apiVersion` field of your resource definition.)

In the next two fields, `resources` and `verbs`, we encounter those REST constructs we discussed earlier. And, in the case of RBAC, we explicitly allow these types of API requests for a user with this `web-rw-deployment` role. Since rules is an array, we may add as many combinations of permissions as are appropriate. All of these permissions are additive. With RBAC, we can only `grant` actions, and this module otherwise denies by default.

| Verb     | HTTP method | Description                                         |
| :------- | :---------- | :-------------------------------------------------- |
| `create` | `POST`      | Create a new resource                               |
| `delete` | `DELETE`    | Delete an existing resource                         |
| `get`    | `GET`       | Get a resource                                      |
| `list`   | `GET`       | List a collection of resources                      |
| `patch`  | `PATCH`     | Modify an existing resource via partial change      |
| `update` | `PUT`       | Modify an existing resource via a complete object   |
| `watch`  | `GET`       | Watch for streaming updates to a resource           |
| `proxy`  | `GET`       | Connect to resource via a streaming WebSocket proxy |

`Role` and `ClusterRole` are identical in functionality and differ only in their scope. The previous example policy is bound to the resources in the `some-web-app-ns` namespaces.

If we want to grant a permission that has cross-namespace capabilities, we use the ClusterRole resource. This resource, in the same manner, grants fine-grained control but on a cluster-wide basis.

`ClusterRoles` are typically employed for two primary use cases—to easily grant cluster administrators a wide degree of freedom or to grant very specific permissions to a Kubernetes controller.

```bash
# built-in cluster roles
kubectl get clusterroles

# view cluster-role-bindings
kubectl get clusterrolebindings
```

While most of these built-in roles are for system utilities, four are designed for
generic end users:

- The `cluster-admin` role provides complete access to the entire cluster.
- The `admin` role provides complete access to a complete namespace.
- The `edit` role allows an end user to modify things in a namespace.
- The `view` role allows for read-only access to a namespace.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: external-dns
rules:
  - apiGroups: ['']
    resources: ['services']
    verbs: ['get', 'watch', 'list']
  - apiGroups: ['extensions']
    resources: ['ingresses']
    verbs: ['get', 'watch', 'list']
```

When the Kubernetes API server starts up, it automatically installs a number of default `ClusterRoles` that are defined in the code of the API server itself. This means that if you modify any built-in cluster role, those modifications are _transient_. Whenever the API server is restarted (e.g., for an upgrade) your changes will be overwritten.

To prevent this from happening, before you make any other modifications you need to add the `rbac.authorization.kubernetes.io/autoupdate` annotation with a value of `false` to the built-in `ClusterRole` resource.

**RoleBinding and ClusterRoleBinding**

To associate these policies with users, groups, or `ServiceAccounts`, we can use the `RoleBinding` and `ClusterRoleBinding` resources.

```yaml
# Associate the `web-rw-deployment` Role
# in the `some-web-app-ns` namespace
# to _joesmith@example.com`, as well as to a group `webdevs`.
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: web-rw-deployment
  namespace: some-web-app-ns
subjects:
  - kind: User
    name: 'joesmith@example.com'
    apiGroup: rbac.authorization.k8s.io
  - kind: Group
    name: 'webdevs'
    apiGroup: rbac.authorization.k8s.io
  - kind: ServiceAccount
    name: testsa
    namespace: some-web-app-ns
roleRef:
  kind: Role
  name: web-rw-deployment
  apiGroup: rbac.authorization.k8s.io
```

```yaml
apiVersion: rbac.authorization.k8s.io/v1beta1
kind: ClusterRoleBinding
metadata:
  name: external-dns-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: external-dns
subjects:
  - kind: ServiceAccount
  name: external-dns
  namespace: default
```

**Testing Authorization with can-i**

The first useful tool is the `auth can-i` command for `kubectl`.

```bash
kubectl auth can-i create pod

# subresourec flag
kubectl auth can-i get pod --subresource=log
```

## Admission Control

_Admission control_ is the third phase of API request onboarding.

By the time we have reached this phase of an API request life cycle, we have already determined that the request has come from a real, authenti‐ cated user and that the user is authorized to perform this request. What we care about now is whether _the request meets the criteria for what we consider to be a valid request_.

Enabling admission control is extremely simple. Since this is an API function, we add the `--enable-admission-plugins` flag to the `kube-apiserver` runtime parameters. This is a comma-delimited list of the admission controllers that we want to enable.

### Common Controllers

Much of the functionality that users take for granted in Kubernetes actually happens by way of admission controllers.

> For example, the _ServiceAccount admission controller_ automatically allocates `Pods` to a `ServiceAccount`. Similarly, if you have tried to add new resources to a `Namespace` that is currently in a terminating state, your request was likely rejected by the _NamespaceLifecycle controller_.

**PodSecurityPolicies**

With `PodSecurityPolicies` controller, administrators can specify the constraints of the pro‐ cesses under Kubernetes’ control.

**ResourceQuota**

Generally speaking, it is good practice to enforce _quotas_ on your cluster. Quotas ensure that no one user is able to utilize more than she has been allocated and is a critical component in driving overall cluster utilization. If you intend to enforce user quotas, you should also enable the `ResourceQuota` controller.

This controller ensures that any newly declared Pods are first evaluated against the current quota utilization for the given namespace.

Note that when a quota is defined for a namespace, all Pod definitions (even if originating from another resource, such as `Deployments` or `ReplicaSets`) are required to specify resource requests and limits.

```yaml
# quota.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: memoryquota
  namespace: memoryexample
spec:
  hard:
    requests.memory: 256Mi
    limits.memory: 512Mi
```

**LimitRange**

A `LimitRange` allows you to place _default resource limits_ for `Pods` that are declared as a member of a particular `Namespace`.

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-mem
spec:
  limits:
    - default:
        memory: 1024Mi
      defaultRequest:
        memory: 512Mi
      type: Container
```

## Dynamic Admission Controllers

Dynamic admission control is the mechanism by which we inject custom business logic into the admission control pipeline.

There are two types of dynamic admission control: validating and mutating.

With _validating admission control_, the business logic simply accepts or rejects a user’s request, based upon our requirements. In the event of failure, an appropriate HTTP status code and reason for failure is returned to the user.

In the _mutating admission controller_ case, we are again evaluating requests against the API server, but in this case we are selectively changing the declaration to meet our objectives.

In both cases, this functionality is implemented using user-defined webhooks. These downstream webhooks are called by the API server when it sees that a qualifying request has been made.

The API server POSTs an `AdmissionReview` object to these webhooks. The body of this request includes the original request, the status of the object, and metadata about the requesting user.

In turn, the webhook provides a simple `AdmissionResponse` object. This object includes fields for whether this request is allowed, a reason and code for failure, and even a field for what a mutating patch would look like.

In order to utilize Dynamic Admission Controllers, you must first configure the API server with a change to the `--enable-admission-plugins` parameter:

```bash
--enable-admission-plugins=...,MutatingAdmissionWebhook,ValidatingAdmissionWebhook
```
