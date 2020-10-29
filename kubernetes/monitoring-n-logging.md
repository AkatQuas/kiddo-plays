[Back to Top](./README.md)

# Monitoring and Logging

It's importance to not just monitor the cluster pieces but also monitor the cluster functionality that users require.

In this case, the best type of monitoring would be a blackbox monitor that continuously deploys a new Pod and Service and that validates that the Service discovery works as expected.

**Differences Between Logging and Monitoring**

Though closely related, they are actually quite different and are used for different problems and often stored in different infrastructure:

- logging records events (e.g., a Pod being created or an API call failing), which is discrete.

- monitoring records statistics (e.g., the latency of a particular request, the CPU used by a process, or the number of requests to a particular endpoint), which is a sampling of some continuous value.

**tech-stacks**

Prometheus, ElasticSearch, Logstash, Kibana, InfluxDB, Grafana, FluentD, Prometheus

## Monitoring operations

Best practices in monitoring are to measure the performance and usage of core resources and watch for trends that stray from the normal baseline.

A key component to managing our Kubernetes cluster is having a clear view into **performance and availability** of the OS, network, system (CPU and memory), and storage resources across all nodes.

**`kubelet`**

The `kublet`, which runs on every node in the cluster, is the main interface for nodes to interact and update the API server.

One such update is the _metrics_ of the node resources. The actual reporting of the resource usage is performed by a program named [`cAdvisor`](https://github.com/google/cadvisor).

`cAdvisor` is another open-source project from Google, which provides various metrics on container resource use. Metrics include CPU, memory, and network statistics.

There is no need to tell `cAdvisor` about individual containers; it _collects the metrics for all containers on a node_ and reports this back to the `kublet`, which in turn reports to [`Heapster`](https://github.com/kubernetes-retired/heapster).

`Heapster` runs in a container on one of the minion nodes and aggregates the data from kublet. A simple REST interface is provided to query the data.

`InfluxDB` is based on a key store package and is perfect to store and query event—or time-based statistics such as those provided by Heapster.

`Grafana`, which provides a dashboard and graphing interface for the data stored in `InfluxDB`. Using `Grafana`, users can create a custom monitoring dashboard and get immediate visibility into the health of their Kubernetes cluster and therefore their entire container infrastructure.

`FluentD` is a collector. It can be configured to have multiple sources to collect and tag logs, which are then sent to various output points for analysis, alerting, or archiving. We can even transform data using plugins before it is passed on to its destination.

**Prometheus**

[Prometheus](https://prometheus.io/):

- A multi-dimensional _data model_ (time series identified by metric name and key/value pairs)
- A _flexible query language_ to leverage this dimensionality
- No reliance on distributed storage; single server nodes are autonomous
- Time series collection happens via a pull model over HTTP
- _pushing time series_ is supported via an intermediary gateway
- Targets are discovered via service discovery or static configuration
- Multiple modes of graphing and dashboard support

To Be Continued
