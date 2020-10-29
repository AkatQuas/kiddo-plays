[Back to Top](./README.md)

# the Kubernetes API Server

The API server is the gateway to the Kubernetes cluster.

The API server implements a RESTful API over HTTP, performs all API operations, and is responsible for storing API objects into a persistent storage backend.

All of the API server’s persistent state is stored in a database that is external to the API server, the server itself is stateless and can be replicated to handle request load and for fault tolerance.

> Typically, in a highly available cluster, the API server is replicated three times.

## Pieces of the API Server

There are three core functions involved when operating the Kubernetes API server:

- API management: the process by which APIs are exposed and managed by the server

- Request processing: the largest set of functionality that processes individual API request from a client

- Internal control loops: internal responsible for background operations necessary to the successful operation of the API server

### API management

Ultimately, the API server is an HTTP server—thus, every API request is an HTTP request.

**API paths**

Every request to the API server follows a RESTful API pattern where the request is defined by the HTTP path of the request.

All Kubernetes requests begin with the prefix `/api/` (the core APIs) or `/apis/` (APIs grouped by API group)

> The two different sets of paths are primarily historical. API groups did not originally exist in the Kubernetes API, so the original or “core” objects, like `Pods` and `Services`, are maintained under the `'/api/'` prefix without an API group. Subsequent APIs have generally been added under API groups, so they follow the `'/apis/<api-group>/'` path. For example, the Job object is part of the batch API group and is thus found under `/apis/batch/v1/....`

One additional wrinkle for resource paths is whether the resource is namespaced.

`Namespaces` in Kubernetes add a layer of grouping to objects, namespaced resources can only be created within a namespace, and the name of that namespace is included in the HTTP path for the namespaced resource.

Here are the components of the two different paths for namespaced resource types:

- /api/v1/namespaces/<namespace-name>/<resource-type-name>/<resource-name>
- /apis/<api-group>/<api-version>/namespaces/<namespace-name>/<resource-type-name>/<resource-name>

Here are the components of the two different paths for non-namespaced resource types:

- /api/v1/<resource-type-name>/<resource-name>
- /apis/<api-group>/<api-version>/<resource-type-name>/<resource-name>

**API discovery**

To be able to make requests to the API, it is necessary to understand which API objects are available to the client.

This process occurs through API discovery on the part of the client.

```bash
# in a node with API server, after `kubectl proxy`
curl localhost:8001/api

curl localhost:8001/api/v1
```

**OpenAPI spec serving**

Knowing the resources and paths to access the API server is only part of the information in order to access the Kubernetes API.

In addition to the HTTP path, you need to know the JSON payload to send and receive. The API server also provides paths to supply you with information about the schemas for Kubernetes resources. These schemas are represented using the OpenAPI (formerly Swagger) syntax.

```bash
curl localhost:8001/openapi/v2
```

**API translation**

In Kubernetes, an API starts out as an alpha API (e.g., `v1alpha1`). Alpha APIs are therefore disabled in production Kubernetes clusters.

> The alpha designation indicates that the API is unstable and unsuitable for production use cases. Users who adopt alpha APIs should expect both that the API surface area may change between Kubernetes releases and that the implementation of the API itself may be unstable and may even destabilize the entire Kubernetes cluster.

Once an API has matured, it becomes a beta API (e.g., `v1beta1`). Beta APIs are generally enabled in production Kubernetes clusters but should be used carefully.

> The beta designation indicates that the API is generally stable but may have bugs or final API surface refinements. In general, beta APIs are assumed to be stable between Kubernetes releases, and backward compatability is a goal. However, in special cases, beta APIs may still be incompatible between Kubernetes releases. Likewise, beta APIs are intended to be stable, but bugs may still exist.

Finally an API becomes generally available (e.g., `v1`). General availability (GA) indicates that the API is stable and suitable for all production usage.

> These APIs come with both a guarantee of backward compatability and a deprecation guarantee. After an API is marked as scheduled for removal, Kubernetes retains the API for at least three releases or one year, whichever comes first. Deprecation is also fairly unlikely. APIs are deprecated only after a superior alternative has been developed.

### Request Management

The main purpose of the API server in Kubernetes is to receive and process API calls in the form of HTTP requests.

These requests are either from other components in the Kubernetes system or they are end-user requests. In either event, they are all processed by the Kubernetes API server in the same manner.

The content type for all of these requests is usually text-based JSON (application/ json) but recent releases of Kubernetes also support Protocol Buffers binary encoding.

In addition to these standard requests, many requests use the WebSocket protocol to enable streaming sessions between client and server. Examples of such protocols are the exec and attach commands.

**Life of a Request**

Here is how the API server deal with a request:

1. Authentication: this establishes the identity associated with the request. Many modes of establishing identity are supported, including client certificates, bearer tokens, and HTTP Basic Authentication.

1. RBAC/Authorization: Every request to Kubernetes follows a traditional RBAC model. When processing a request, the API server determines whether the identity associated with the request can access the combination of the verb and the HTTP path in the request.

1. Admission Control: Authentication and RBAC determine whether the request is allowed to occur. However, Admission control determines whether the request is well formed and potentially applies modifications to the request before it is processed. Admission control defines a pluggable interface: `apply(request): (transformedRequest, error)`. If any admission controller finds an error, the request is rejected. If the request is accepted, the transformed request is used instead of the initial request. Admission controllers are called serially, each receiving the output of the previous one.

1. Validation: Validation is only performed on a single object. Request validation ensures that a specific resource included in a request is valid. In general, validation is implemented as custom code that is defined per resource type.

**Specialized requests**

In addition to the standard RESTful requests, the API server has a number of speciallized request patterns that provide expanded functionality to clients: `/proxy`, `/exec`, `/attach`, `/logs`. These requests provide streaming data rather than immediate responses. Some of the operations take advantage of the WebSocket protocol for bidirectional streaming data. They also actually multiplex data within those streams to enable an arbitrary number of bidirectional streams over HTTP.

**Watch operations**

In addition to streaming data, the API server supports a watch API. A watch monitors a path for changes.

Instead of polling at some interval for possible updates, which introduces either extra load (due to fast polling) or extra latency (because of slow polling), using a watch enables a user to get low-latency updates with a single connection.

> When a user establishes a watch connection to the API server by adding the query parameter `?watch=true` to some API server request, the API server switches into watch mode, and it leaves the connection between client and server open. Likewise, the data returned by the API server is no longer just the API object—it is a `Watch` object that contains both the type of the change (created, updated, deleted) and the API object itself. In this way, a client can watch and observe all changes to that object or set of objects.

**Optimistically concurrent updates**

API server support another advanced operation, the ability to perform _optimistically concurrent_ updates of the Kubernetes API.

> The idea behind optimistic concurrency is the ability to perform most operations without using locks (pessimistic concurrency) and instead detect when a concurrent write has occurred, rejecting the later of the two concurrent writes. A write that is rejected is not retried (it is up to the client to detect the conflict and retry the write themselves).

**Alternate encodings**

API server support two other formats for requests in addition to JSON encoding. The encoding of the requests is indicated by the Content-Type HTTP header on the request.

If this header is missing, the content is assumed to be `application/json`, which indicates JSON encoding.

The first alternate encoding is `YAML`, which is indicated by the `application/yaml` Content Type.

The other alternate encoding for requests and responses is the Protocol Buffers encoding format, which is indicated by the `application/vnd.kubernetes.protobuf` Content-Type header. Protocol Buffers are a fairly efficient binary object protocol. Using Protocol Buffers can result in more efficient and higher throughput requests to the API servers. Indeed, many of the Kubernetes internal tools use Protocol Buffers as their transport.

## API Server Internals

Generally, these sorts of control loops are run in a separate binary known as the controller manager. But there are a few control loops that have to be run inside the API server.

### Custom Resource Definition Loop / CRD Loop

Custom resource definitions (CRDs) are dynamic API objects that can be added to a running API server.

Because the act of creating a CRD inherently creates new HTTP paths the API server must know how to serve, the controller that is responsible for adding these paths is colocated inside the API server.

The CRD control loop operates as follows:

```
for crd in AllCustomResourceDefinitions:
 if !RegisteredPath(crd):
   registerPath

for path in AllRegisteredPaths:
 if !CustomResourceExists(path):
   markPathInvalid(path)
   delete custom resource data
   delete path
```

The creation of the custom resource path is fairly straightforward, but the deletion of a custom resource is a little more complicated. This is because the deletion of a custom resource implies the deletion of all data associated with resources of that type. This is so that, if a CRD is deleted and then at some later date readded, the old data does not somehow get resurrected.

Thus, before the HTTP serving path can be removed, the path is first marked as invalid so that new resources cannot be created. Then, all data associated with the CRD is deleted, and finally, the path is removed.
