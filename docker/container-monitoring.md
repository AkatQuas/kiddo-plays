[back to home](./README.md)

## Observability with containerized monitoring

A well-established approach to monitoring with Docker: exposing metrics from the application containers and using Prometheus to collect them and Grafana to visualize them in human-friendly dashboards.

> In a traditional environment, you might have a monitoring dashboard showing a list of servers and their current utilization -- disk space, memory, CPU -- and alerts to tell you if any become overworked and are likely to stop responding.

You need a monitoring approach that is container-aware, with tools that can plug into the container platform for discovery and find all the running applications without a static list of container IP addresses.

> Prometheus runs in a Docker container, so you can easily add a monitoring stack to your applications.

Prometheus does several things: it runs a scheduled job to pull the metrics from your Docker host, it stores those metric values alongside a timestamp in its own database, and it has a basic web UI you can use to navigate the metrics. The Prometheus UI shows all the information from Docker’s `/metrics` endpoint, and you can filter the metrics and display them in tables or graphs.

The applications can also expose their own metrics, which will also record details at different levels. The goal is to have a metrics endpoint in each of the containers and have Prometheus collect metrics from them all on a regular schedule.

Exposing a useful set of metrics from each of your application containers takes more effort, because you need code to capture the metrics and provide the HTTP endpoint for Prometheus to call.

Using official Prometheus clients to collect and expose metrics. The information points collected from a Prometheus client library are runtime-level metrics. They provide key information regarding what your container is doing and how hard it is working, in terms that are relevant to the application runtime.

> You can explicitly write some code, using prometheus-client, to capture key information about the application. These are the metrics that could be operations-focused, showing the number of events a component has processed or the average time to process a response. Or they could be business-focused, showing the current number of active users or the number of people signing up to a new service.

### Running a Prometheus container to collect metrics

Prometheus uses a pull model to collect metrics. Rather than have other systems send it data, it fetches data from those systems. It calls this _scraping_, and when you deploy Prometheus you configure the endpoints you want it to scrape.

In a production container platform, you can configure Prometheus so it automatically finds all the containers across the cluster. In Docker Compose on a single server, you use a simple list of service names, and Prometheus finds the containers through Docker’s DNS.

```yaml
# example
global:
  scrape_interval: 10s

scrape_configs:
  - job_name: 'access-log'
    metrics_path: /metrics
    scrape_interval: 3s
    # multiple IP addresses,
    # Prometheus will build a list of all the IP adderss
    # and poll them all on the same schedule
    dns_sd_configs:
      - names:
          - accesslog
        type: A
        port: 80

  - job_name: 'docker'
    metrics_path: /metrics
    # expect only one components
    # even with multiple-containers, use the first IP from the Docker DNS list.
    static_configs:
      - targets: ['DOCKER_HOST:9323']
```

PromQL is a powerful language with statistical functions that let you query changes over time and rate of change, and you can add subqueries to correlate different metrics.

### Running a Grafana container to visualize metrics

What metrics you need to capture will depend on your business and operational needs, and how you capture them will depend on the application runtime you’re using and the mechanics of the Prometheus client library for that runtime.

Grafana helps to show up the data into user-friendly visulization.

The Grafana dashboard conveys key information across many different levels of the application. It looks complicated, but each visualization is powered by a single PromQL query, and none of the queries do anything more complex than filtering and aggregating.

### Understanding the levels of observability

Observability is a key requirement when you move from simple proof-of-concept containers to getting ready for production.

There would be an infrastructure dashboard showing free disk space, available CPU, and memory and network saturation for all the servers. Each component might have its own dashboard showing additional information, like a breakdown of response times for serving each page of a web app or each API endpoint.

## Reference

[Collect Docker metrics with Prometheus](https://docs.docker.com/config/daemon/prometheus/)

[Configuration guidance for Prometheus](https://prometheus.io/docs/prometheus/latest/configuration/configuration/)

[Configuration guidance for Grafana](https://grafana.com/docs/grafana/latest/administration/configuration/)
