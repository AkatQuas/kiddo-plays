[back to home](./README.md)

# Production Practices

<details>
<summary>

## Optimizing the image

TL;DR

- Choose the right base image, ideally curate your own set of golden images.
- Use multi-stage Dockerfiles for all but the simplest apps.
- Don’t add any unnecessary packages or files, focus on layer size.
- Sort your Dockerfile instructions by change frequency, maximize the cache.

</summary>

```bash
# show used disk space
docker system df
```

> It's a good habit to run `docker system prune` regularly -- it clears out image layers and the build cache without removing full images.

**Do not include/copy files in the image unless they are required**.

You could using the `.dockerignore` file to exclude them from the build context.

```Dockerfile
FROM diamol/base
CMD echo app- && ls app && echo docs- && ls docs
COPY . .
# this `rm -rf` doesn't remove the files in `COPY` layer
# the file still exist in `COPY` layer
RUN rm -rf docs
```

> Each instruction in a Dockerfile produces an image layer, and layers are merged together to form the whole image. If you write files in a layer, those files are permanently there; if you delete them in a subsequent layer, all Docker does is hide them in the filesystem.

**Choose the right base images.**

Base image size choice is as much about security as it is about disk space and network transfer time.

> If your OS base image has curl installed, an attacker could use that to download malware or upload your data to their servers, if they manage to break out of your app into the container.

Size isn’t just about disk space -- it’s also about what’s using the space.

> The largest OpenJDK images include the whole Java SDK, so there’s a nice attack vector there if someone manages to compromise your container. They could write some Java source code files into the container’s disk, compile them with the SDK, and run an app that does anything they want in the security context of your application container.

You have a team that chooses the right base images and builds their own versions for your organization, which is called the _Golden images_.

Another advantage of building your own golden image is that you can integrate additional security checks on the base layer in the build process, using a third-party tool like Anchore.

**Minimizing image layer count and layer size**

Many processes for installing software leave residues behind because they cache package lists or deploy extra recommend packages. You can remove some cache files after installation.

```Dockerfile
FROM debian:stretch-slim
RUN apt-get update
RUN apt-get install -y curl=7.52.1-5+deb9u9
RUN apt-get install -y socat=1.7.3.1-2+deb9u1
# Dockerfile.v2 - optimizing the install steps:
FROM debian:stretch-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends \ curl=7.52.1-5+deb9u9 \ socat=1.7.3.1-2+deb9u1 \
  && rm -rf /var/lib/apt/lists/*
```

Another advantage of combining multiple steps in a single `RUN` instruction is that it produces a single image layer.

Having fewer layers does make it much easier to keep track of your filesystem.

Multi-stage Dockerfiles should be a best practice for all but the simplest images, because they make it far easier to optimize the final image.

```Dockerfile
FROM diamol/base AS download
ARG DATASET_URL=https://archive.ics.uci.edu/ml/machine-learning-databases/url/url_svmlight.tar.gz
RUN wget -O dataset.tar.gz ${DATASET_URL}

FROM diamol/base AS expand
COPY --from=download dataset.tar.gz .
RUN tar xvzf dataset.tar.gz

FROM diamol/base
WORKDIR /dataset/url_svmlight
COPY --from=expand url_svmlight/Day1.svm .
```

It’s clear in each stage what you’re doing, and you don’t need to dive into unusual command optimizations to save disk space, because the final image will only have the files explicitly copied in from earlier stages.

One final advantage of multi-stage builds really brings it home: every stage has its own build cache. If you need to tweak the expand stage, when you run the build, the download stage will still come from the cache. Maximizing the build cache is the final part of optimization, and this is all about the speed of building the image.

The basic way to make the most of the build cache is to order the instructions in your Dockerfile so the things that change least frequently are at the start, and the things that change most frequently are toward the end.

</details>

<details>
<summary>

## Application configuration management in containers

Applications need to load their configuration from the environment they’re running in, which is usually a combination of environment variables and files read from disk.

Docker creates that environment for apps running in containers, and it can set environment variables and construct a filesystem from many different sources.

</summary>

### A multi-tiered approach to app configuration

The configuration model should reflect the structure of the data, which is typically one of three types:

- Release-level settings, which are the same for every environment for a given release
- Environment-level settings, which are different for every environment
- Feature-level settings, which can be used to change behavior between releases

Loading config overrides from a known path in your app code lets you provide them from any source into the container.

Mount different config directory to provide environment-based configuration.

There’s one nuance to this pattern -- your config target can either be a specific file path or a directory. A directory target is more flexible, but the source file names need to match the config file names the app expects.

The configuration can also load settings from environment variables, and they override any settings loaded from the file herarchy.

> This is the configuration approach recommended in [The Twelve-Factor App](https://12factor.net) -- a modern style of application architecture, where _environment variables always take precedence over other config sources_.

### Packaging config for every environment

Many application frameworks support a config management system where you bundle all the config files for every environment in your deployment, and at runtime you set a single value to specify the name of the environment you’re running in. The app platform loads the config file with the matching environment name, and your app is fully configured.

- config.json
- config.{ENV}.json
- _Environment variables_

This is kind of dangerous because all the config settings are included in the image. Be careful when using this approach.

### Loading configuration from the runtime

You add the module to your package list, and in your application code you specify the paths to the config directories and whether you want environment variables brought in to override the config files.

- Files are loaded from the config directory first which is populated in the Docker image.

- Environment-specific files are loaded from the config-override directory, which is empty in the image and can be the target for a container filesystem mount.
- Environment variables override the file settings.

A config API is a very useful feature in your app when you have multiple layers of config sources; it makes debugging configuration issues much easier, but you need to secure that data:

- Don't just publish the whole config; be selective and never include secrets;
- Secure the endpoint so only authorized users can access it;
- Make the config API a feature that can be enabled through config;

### Configuring legacy apps in the same way as new apps

Legacy apps have their own ideas about configuration, which don’t usually involve environment variables or file merges.

The approach here is to package a utility app or set of scripts that transform the configuration settings in the container environment into the configuration model the application expects. The exact implementation will depend on your app framework and how it uses config files, but the logic will be something like this:

1. Read in the config override settings from a specified source file in the container.
1. Read in the overrides from environment variables.
1. Merge the two sets of overrides, so environment variables take precedence.
1. Write the merged overrides to the specified target file in the container.

In practice you’ll use the release-level settings built into the container image, with the environment-level override file provided by the container platform in almost all cases, but the ability to set feature-level config with environment variables is a useful addition. It means you can react quickly to production issues—tuning down the level of logging if that’s a performance issue, or turning off a feature that has a security hole. It also means you can create a production-like environment on a dev machine to replicate a bug, using the production config override with secrets removed, and using environment variables instead.

</details>

<details>
<summary>

## Writing and managing application logs

The basic principle is simple: you need to make sure your application logs are being written to the standard output stream, because that’s where Docker looks for them.

Docker has a pluggable logging framework: you need to make sure your application logs are coming out from the container, and then Docker can send them to different places. That lets you build a powerful logging model, where the application logs from all your containers are sent to a central log store with a searchable UI on top of it -- all using open source components, all running in containers.

</summary>

### stderr and stdout

In a container, Docker watches stdout and stderr and collects the output from the streams, which is the source of the container logs.

Docker starts a process inside the container and collects the output streams from that process as logs. Docker treats both stdout and stderr in the same way.

Container logs are stored as _JSON files_, so the log entries remain available for detached containers which don’t have a terminal session, and for containers that have exited so there is no application process. Docker manages the JSON files for you and they have the same life cycle as the container, which means when the container is removed, the log files are removed too.

The format is very simple; it contains a JSON object for each log entry with the string containing the log, the name of the stream where the log came from (stdout or stderr), and a timestamp.

Docker creates a single JSON log file for each container by default, and will let it grow to any size (until it fills up your disk). You can configure Docker to use rolling files instead, with a maximum size limit, so that when the log file fills up, Docker starts writing to a new file. You also configure how many log files to use, and when they’re all full, Docker starts overwriting the first file.

You can set those options at the Docker Engine level so the changes apply to every container, or you can set them for individual containers.

```bash
docker container run -d --name timecheck2 --log-opt max-size=5k --log-opt max-file=3 IMAGE
```

### Replaying logs from other sinks to stdout

Some applications run in the background, so the container startup process isn't actually the application process. Other apps might use an existing logging framework that writes to log files or other locations (called _sinks_ in the logging world).

Either way, there are no application logs coming from the container start process, so Docker doesn’t see any logs.

The pattern for dealing with apps like this is to run a second process in the container startup command, which reads the log entries from the sink that the application uses and writes them to stdout.

> This is not a perfect solution. Your utility process is running in the foreground, so it needs to be robust because if it fails, your container exits, even if the actual application is still working in the background. And the reverse is true: if the application fails but the log relay keeps running, your container stays up even though the app is no longer working. You need health checks in your image to prevent that from happening. And lastly, this is not an efficient use of disk, especially if your app writes a lot of logs—they’ll be filling up a file in the container filesystem and filling up a JSON file on the Docker host machine.

### Collecting and forwarding container logs

Docker adds a consistent management layer over all your apps, which is especially useful with logs when you bring a consolidated logging system into your architecture.

Fluented is a unified logging layer. It can ingest logs from lots of different sources, filter or enrich the log entries, and then forward them on to lots of different targets.

Fluentd uses a config file to process logs. Run a container with a simple configuration that will have Fluentd collect logs and echo them to stdout in the container.

```bash
# run Fluentd publishing the standard port and using a config file:
docker container run -d -p 24224:24224 --name fluentd -v "$(pwd)/conf:/fluentd/etc" -e FLUENTD_CONF=stdout.conf fluentd

# now run some container set to use Docker's Fluentd log driver:
docker container run -d --log-driver=fluentd IMAGE
```

Fluentd adds its own metadata to each record when it stores logs, including the container ID and name.

<details>
<summary>

You can run Fluentd to collect all the logs, Elasticsearch in a container for log storage and the companion app Kibana, which is a search UI, in another container.

</summary>

```yaml
# docker-compose
version: '3.7'

services:
  # log collector, forwarder
  fluentd:
    image: fluentd
    environment:
      FLUENTD_CONF: elasticsearch.conf
    volumes:
      - ./conf:/fluentd/etc
    ports:
      - '24224:24224'
      - '24224:24224/udp'

  # log saver
  elasticsearch:
    image: elasticsearch
    ports:
      - '9200:9200'

  # GUI for log search
  kibana:
    image: kibana
    ports:
      - '5601:5601'

  # this container produce logs
  accesslog:
    image: access-log
    logging:
      driver: 'fluentd'
      options:
        tag: 'app.access-log.{{.ImageName}}'
```

```conf
# elasticsearch.conf
# fluentd/conf/fluent.conf
<source>
  @type forward
  port 24224
  bind 0.0.0.0
</source>
<match *.**>
  @type copy
  <store>
    @type elasticsearch
    host elasticsearch
    port 9200
    logstash_format true
    logstash_prefix fluentd
    logstash_dateformat %Y%m%d
    include_tag_key true
    type_name access_log
    tag_key @log_name
    flush_interval 1s
  </store>
  <store>
    @type stdout
  </store>
</match>
```

</details>

### Managing the log output and collection

Logging is a delicate balance between capturing enough information to be useful in diagnosing problems and not storing huge quantities of data.

Docker’s logging model gives you some additional flexibility to help with the balance, because you can produce container logs at a more verbose level than you expect to use, but filter them out before you store them.

Then if you need to see more verbose logs, you can alter the filter configuration rather than your app configuration so the Fluentd containers get replaced rather than your app containers.

### The Container logging model

**EFK**: Elasticsearch, Fluentd, Kibana

- A Fluentd container runs on every node in the cluster. Application containers always send logs to the local Fluentd instance on the same node.

- Elasticsearch is clustered, and the containers/replicas could run any node. The Fluentd containers send log records to the cluster.

- Kibana reads from the Elasticsearch cluster, give us GUI display.

</details>

<details>
<summary>

## Controlling HTTP traffic with a reverse proxy

Docker takes care of routing external traffic into your containers, but you can only have one container listening on a network port.

That’s where a _reverse proxy_ comes in.

</summary>

### Reverse proxy

A proxy is a network component that handles network traffic on behalf of some other component. You might have a proxy in your corporate network that:

- intercepts your browser requests and decides whether you’re allowed to access certain sites,
- logs all your activity,
- and caches the responses so other users of the same site get a faster experience.

You run a reverse proxy as the gateway to several web applications; all traffic goes to the reverse proxy, and it decides which app to get the content from.

A reverse proxy is the only container with published ports -- it receives all incoming request and fetches the responses from other containers. That means all your application containers become internal components, which can make it easier to scale, update, and secure them.

You can routing to services using Nginx without Docker Swarm or Kubernetes.

Nginx can work as a caching proxy, so when it fetches content from your application (called the _upstream_), it stores a copy in its local disk or memory store.

### cloud-native reverse proxy

Traefik.

There’s no static configuration file for each app you want to make available in the proxy; instead, you add labels to your containers, and Traefik uses those labels to build its own configuration and routing maps.

Dynamic configuration is one of the major benefits of a container-aware proxy like Traefik. You don’t need to start your upstream apps before you run Traefik because it watches for new containers while it’s running. You don’t have to restart Traefik or reload configuration to make a change to your application setup—that’s all part of your application deployment.

Traefik has its own API and web UI that shows the rules, so you can run Traefik without any other containers and then deploy an application and see how the config gets built.

How Traefik works:

- **Entrypoints**: These are the ports Traefik listens on for external traffic, so these map to the published ports for the container.

- **Routers**: These are the rules for matching an incoming request to a target container. HTTP routers have rules like host name and path to identify client requests.

- **Services**: These are the upstream components -- the application containers that actually serve the content to Traefik so it can pass the response back to the client.

- **Middlewares**: These are components that can modify requests from a router before they get sent to the service. You can use middleware components to change the request path or headers, or even to enforce authentication.

Applying some labels on the container to enable Traefik.

```yaml
services:
  upservice:
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.upservice.rule=Host(`upservice.ip`)'

  iotd:
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.image-gallery-api.rule=(Host(`iotd.local`) && PathPrefix(`/api`))'
      - 'traefik.http.middlewares.image-gallery-api-stripprefix.stripprefix.prefixes=/api,/api/'
      - 'traefik.http.routers.image-gallery-api.middlewares=image-gallery-api-stripprefix@docker'

  image-gallery:
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.image-gallery.rule=Host(`image-gallery.local`)'
      - 'traefik.http.services.image-gallery.loadbalancer.server.port=80'
```

Traefik supports some very sophisticated routing options. You can match by host name and path, or a path prefix, and then use a middleware component to strip prefixes

Routing, load-balancing, and SSL termination are the main features of a reverse proxy, and Traefik supports them all with dynamic configuration through container labels.

There's a sticky session, which you can enable in Traefik with a setting for the service. With sticky sessions enabled, your requests get served by the same container each time because Traefik sets a cookie identifying which container it should use for that client.

</details>

<details>
<summary>

## Asynchronous communication with message queue

Asynchronous communication adds a layer between the client and the server.

If the client needs a server to do something, it sends a message to the queue. The server is listening on the queue, picks up the message, and processes it. The server can send a response message to the queue, and if the client wants a response, it will be listening on the queue and will pick it up.

Running queues in lightweight containers means you can run a dedicated queue for each application, and free open source software means you can use the same technology in every environment.

Redis is a popular message queue option and you can easily try it out to get a feel for asynchronous message.

Queues usually have their own custom communication protocol, which is highly optimized, so when the client sends a message, it just transmits the bytes of the request and waits for an acknowledgement that it has been received. Queues don’t do any complex processing on the message, so they should easily handle thousands of messages per second.

The component sending messages is the _publisher_, and the component receiving messages is the _subscriber_.

There could be lots of different systems using the queue, so Redis uses _channels_ to keep messages separate.

NATS is an alternative message queue; it’s very lightweight and has an admin API.

Every message in NATS has a subject, which is a string used to identify the type of the message.

Subscribers will be able to for messages with that subject if they’re interested in new-item events, but even if there are no subscribers, the app will still publish messages.

</summary>

</details>
