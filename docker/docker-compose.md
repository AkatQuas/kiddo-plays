[back to home](./README.md)

Modern cloud-native apps are made of multiple smaller services that interact to form a useful app. We call this pattern _microservices_. A simple example might be an app with the following seven services:

- Webfront-end
- Ordering
- Catalog
- Back-enddatabase
- Logging
- Authentication
- Authorization

Get all of these working together, and you have a useful application.

## Docker Compose

Each component runs in its own lightweight container, and Docker plugs them together using standard network protocols.

Compose is a file format for describing distributed Docker apps, and it's a tool for managing them.

Dockerfile is a script for packaging only an application.

The Docker Compose file describes the desired state of your app -- what it should look like when everything’s running.

It’s a simple file format where you place all the options you would put in your `docker container run` commands into the Compose file. Then you use the Docker Compose tool to run the app. It works out what Docker resources it needs, which could be containers, networks, or volumes -- and it sends requests to the Docker API to create them.

Docker Compose uses YAML.

Docker Compose is a client-side tool. It’s a command line that sends instructions to the Docker API based on the contents of the Compose file. Docker itself just runs containers; it isn’t aware that how many containers to represent a single application. Only Compose knows that, and Compose only knows the structure of your application by looking at the Docker Compose YAML file, so you need to have that file always available to manage your app.

```bash
docker-compose up
docker-compose down

docker-compose start
docker-compose stop

docker-compose rm

docker-compose restart

docker-compose ps
docker-compose top
```

<details>
<summary>
An example docker compose file for running single container
</summary>

- `version` is the version of the Docker Compose format used in this file. The feature set has evolved over many releases, so the version here identifies which releases this definition works with.

- `services` lists all the components that make up the application. Docker Compose uses the idea of services instead of actual containers, because a service could be run at scale with several containers from the same image.

- `networks` lists all the Docker networks that the service containers can plug into. By default, Compose will create bridge networks. These are single-host networks that can only connect containers on the same Docker host. However, you can use the driver property to specify different network types.

- `volumes` tells Docker to create new volumes.

The volumes won't be deleted after the `docker-compose down`. Volumes are intended to be long-term persistent data stores. As such, their lifecycle is entirely decoupled from the applications they serve. Running a docker volume ls will show that the volume is still present on the system. If you’d written any data to the volume, that data would still exist.

```yaml
version: '3.7'

services:
  # equivalent docker command ⬇️
  # docker container run- p 8020:80 --name todo-web --network nat todo-list
  todo-web: # a service calle `todo-web`
    image: todo-list # run container from image `todo-list`
    ports:
      - '8020:80' # publish host port to container port
    networks:
      - app-net # plug into the `app-net` network inside the compose file

networks:
  app-net:
    external:
      name: nat
```

The service name becomes the container name and the DNS name of the container, which other containers can use to connect on the Docker network. The network name in the service is `app-net`, but under the networks section that network is specified as mapping to an external network called `nat`. The external option means Compose expects the nat network to already exist, and it won’t try to create it.

To start the compose

```bash
docker network create nat

cd path/to/directory/with/docker-compose.yaml

docker-compose up
```

</details>

<details>
<summary>
An example to run multi-container application with compose
</summary>

```yaml
version: '3.7'

services:
  accesslog:
    image: access-log
    networks:
      - app-net

  api:
    build: . # build a new image using Dockerfile in the current directory (.)
    command: node server.js # run this command as the main process, override CMD in Dockerfile
    restart: unless-stopped
    environment:
      - VERSION=1.1.2
    volumes:
      # bind mount directory
      - type: bind
        source: /data/assets
        target: /app/assets
    ports:
      - '80' # publish port 80 on the container to a random port on the host
    networks:
      - app-net

  server:
    image: front-server
    restart: on-failure
    ports:
      # publish port: 8010 on the host to port 80 on the container
      - target: 80
        published: 8010
    depends_on: # dependency on the other services
      - accesslog
      - api
    volumes:
      - type: volume
        source: assets
        target: /container/directory
    networks:
      - app-net

networks:
  app-net:
    external:
      name: nat
  over-net:
    driver: overlay
    attachable: true

volumes:
  assets:
```

```bash
docker-compose up --detach

# some time elapse
# scale the api service to a scale of 3
docker-compose up -d --scale api=3
```

</details>

### Howe Docker plugs containers together

All the components in a distributed application run in Docker containers with Compose, but how do they communicate with each other?

A container is a virtualized environment with its own network space. Each container has a virtual IP address assigned by Docker, and containers plugged into the same Docker network can reach each other using their IP addresses. But containers get replaced during the application life cycle, and new containers will have new IP addresses, so Docker also supports service discovery with DNS.

Docker has its own DNS service built in. Apps running in containers make domain lookups when they try to access other components. The DNS service in Docker performs that lookup -- if the domain name is actually a container name, Docker returns the container’s IP address, and the consumer can work directly across the Docker network. If the domain name isn’t a container, Docker passes the request on to the host where Docker is running, so it will make a standard DNS lookup to find an IP address on host’s network or the public internet.

Containers plugged into the same Docker network will get IP addresses in the same network range, and they connect over that network. Using DNS means that when your containers get replaced and the IP address changes, your app still works because the DNS service in Docker will always return the current container’s IP address from the domain lookup.

DNS servers can return multiple IP address for a domain name. Docker Compose uses this mechanism for simple load-balancing, returning all the container IP addresses for a service. To try to provide load-balancing across all the containers, the Docker DNS returns the list in a different order each time.

Plugging app configuration into the Compose file lets you use the same Docker images in different ways and be explicit about the settings for each environment. You can have separate Compose files for your development and test environments, publishing different ports and triggering different features of the app.

### Understanding the problem Docker Compose solves

Docker Compose is a very neat way of describing the setup for complex distributed apps in a small, clear file format.

Compose lets you define your application and apply the definition to a single machine running Docker. It compares the live Docker resources on that machine with the resources described in the Compose file, and it will send requests to the Docker API to replace resources that have been updated and create new resources where they are needed.

It is not a full container platform like Docker Swarm or Kubernetes—it does not continually run to make sure your application keeps its desired state. If containers fail or if you remove them manually, Docker Compose will not restart or replace them until you explicitly run docker-compose up again.

## Docker Compose in Multiple Environments

Docker Compose is a tool for running multi-container applications on a single Docker Engine.

> Under the same project (environment), Docker Compose won't start any new instance of the application if it thinks you’re asking it to run an application that is already running.

Docker Compose uses the concept of a _project_ to identify that various resources are part of the same application, and it uses the name of the directory that contains the Compose file as the default project name.

> Using `-p` or `--project-name` to specify different project.

Compose prefixes the project name when it creates resources, and for containers it also adds a numeric counter as a suffix.

> So if your Compose file is in a folder called `app1`, and it defines one service called `web` and one volume called `disk`, Compose will deploy it by creating a volume called `app1_disk` and a container called `app1_web_1`. The counter at the end of the container name supports scale, so if you scale that up to two instances of the web service, the new container will be called `app1_web_2`.

### Using Docker Compose override files

[official reference](https://docs.docker.com/compose/reference/overview/#use--f-to-specify-name-and-path-of-one-or-more-compose-files)

Teams hit the problem of trying to run different app configurations with Docker Compose and often end up with many Compose files -- one for each environment.

However, Docker Compose lets you merge multiple files together, with properties from later files overriding those from earlier in the merge.

Docker Compose merges files together when you specify multiple file paths in docker-compose commands. The config command is very useful here—it validates the contents of the input files, and if the input is valid, it writes out the final output. You can use that to see what will happen when you apply an override file.

If you up the application with multiple compose files, you need to use all the same options when you tear down it.

```bash
# start the application
docker-compose -f ./docker-compose.yml -f ./docker-compose-dev.yml -p dev up

# tear down
docker-compose -f ./docker-compose.yml -f ./docker-compose-dev.yml -p dev down
```

<details>
<summary>
An example to illustrate how to use overrides to structure an easily maintainable set of Compose files.
</summary>

In the override file you just specify the properties you care about, but you need to preserve the structure of the main Compose file so that Docker Compose can link the definitions together.

The other override files follow the same pattern. Each environment uses different ports for the web application and the API so you can run them all on a single machine.

```bash
# validate and inspect the compose.yml files
docker-compose -f ./docker-compose.yml -f ./docker-compose-dev.yml config
docker-compose -f ./docker-compose.yml -f ./docker-compose-test.yml config
docker-compose -f ./docker-compose.yml -f ./docker-compose-uat.yml config
```

```yaml
# docker-compose.yml
# Only services and basic settings
version: '3.7'

services:
  api:
    image: api:v3
    networks:
      - app-net

  web:
    image: web:v3
    environment:
      - ServerApi__Url=http://api/api
    networks:
      - app-net

networks:
  app-net:
```

```yaml
# docker-compose-dev.yml
# Settings (services/network) for development
version: '3.7'

services:
  api:
    ports:
      - '8087:80'
    healthcheck:
      disable: true

  web:
    entrypoint:
      - node
      - static-web.js
    ports:
      - '8088:80'

networks:
  app-net:
    name: dev
```

```yaml
# docker-compose-test.yml
# Settings (services/network) for test
version: '3.7'

services:
  api:
    image: api:v3-fix # using differrent version
    healthcheck:
      interval: 20s
      start_period: 15s
      retries: 4

  web:
    ports:
      - '8080:80'
    restart: on-failure
    healthcheck:
      test: ['CMD', 'node', 'health-check.js']
      interval: 20s
      timeout: 10s
      retries: 4
      start_period: 10s

networks:
  app-net:
    name: test
```

```yaml
# docker-compose-uat.yml
# Settings for User-Acceptance-Test environment
version: '3.7'

services:
  api:
    healthcheck:
      interval: 10s
      retries: 2
    restart: always
    ports:
      - '8090:80'

  web:
    restart: always
    ports:
      - '80:80'
    healthcheck:
      interval: 10s
      retries: 2

networks:
  app-net:
    name: uat
```

</details>

### Injecting configuration with environment variables and secrets

Most applications can read configuration settings from environment variables or files, and Compose has good support for both those approaches.

This secret is specified as coming from the source `db-connection`, which means there needs to be a secret with that name defined in the Compose file.

Secrets are a useful way of injecting configuration -- they have support in Docker Compose, Docker Swarm, and Kubernetes.

```yaml
version: '3.7'

services:
  web:
    image: web:v1
    ports:
      - '${HOST_WEB_PORT:-8090}:80' # using environment variable, default would be 8090
    environment:
      - Database:Provider=Sqlite
    env_file:
      # path to a text dotenv file
      - ./config/logging.debug.env

    secrets:
      # The source is the place where the secret
      #   is loaded from the container runtime
      # The target is the file path where the secret
      #   is surfaced inside the container
      - source: db-connection
        target: /app/config/secrets.json

  api:
    # if the environment variable not exist, using v1 instead
    image: api:${BUILD_VERSION:-v1}
    secrets:
      - source: redis-connection
        target: /app/config/ # copy all the directory files

secrets:
  db-connection:
    file: ./config/secrets.json
  redis-connection:
    file: ./config/dev # directory with multiple config.json
```

```bash
# .env file
HOST_WEB_PORT=8877
```

> Keeping an environment file alongside your Compose files helps to document which sets of files represent which environment, but be aware that Docker Compose only looks for a file called `.env`. You can’t specify a filename, so you can’t easily switch between environments with multiple environment files.

Useful tips:

- Using the `environment` property to specify environment variables is the simplest option, and it makes your application configuration easy to read from the Compose file. Those settings are in plain text, though, so you shouldn’t use them for sensitive data like connection strings or API keys.

- Loading configuration files with `secret` properties is the most flexible option, because it’s supported by all the container runtimes and it can be used for sensitive data. The source of the secret could be _a local file when you’re using Compose_, or it could be an encrypted secret stored in a Docker Swarm or Kubernetes cluster. Whatever the source, the contents of the secret get loaded into a file in the container for the application to read.

- Storing settings in a file and loading them into containers with the `environment_file` property is useful when you have lots of shared settings between services. Compose reads the file locally and sets the individual values as environment properties, so you can use local environment files when you’re connected to a remote Docker Engine.

- The Compose environment file, `.env`, is useful for capturing the setup for whichever environment you want to be the default deployment target.

<details>
<summary>

Reducing duplication with extendsion fields

</summary>

Using extension fields to define blocks of YAML in a single place, which you can reuse throughout the Compose file.

```yaml
x-labels: &logging
  logging:
    options:
      max-size: '100m'
      max-file: '10'

x-labels: &labels
  app-name: image-web

# used in compose file
version: "3.7"

x-labels: &logging
  logging:
    options:
      max-size: '100m'
      max-file: '10'

x-labels: &labels
  app-name: image-web

services:
  accesslog:
    <<: *logging
    labels:
      <<: *labels

  prometheus:
    image: prometheus
    ports:
      - "9090:9090"
    environment:
      - DOCKER_HOST=${HOST_IP}
    networks:
      - app-net
    <<: *logging
    labels:
      <<: *labels

  grafana:
    image: grafana
    ports:
      - "3000:3000"
    depends_on:
      - prometheus
    networks:
      - app-net
    <<: *logging
    labels:
      <<: *labels
```

</details>

### The configuration workflow with Docker

- **Application composition** :Not every environment will run the whole stack. Override files makes this work neatly, sharing common services and adding specific ones in each environment.

- **Container configuration**: Properties need to change to match the requirements and capabilities of the environment. Overrides enable this, along with isolated Docker networks for each application, allowing you to run multiple environments on a single server.

- **Application configuration**: The behavior of applications inside containers will change between environments. You can do this using Compose with any combination of override files, environment files, and secrets.

The most important takeaway from this is that the configuration workflow uses the same Docker image in every environment.

### References

[Guidance on docker-compose CLI](https://docs.docker.com/compose/reference/overview/)

[Reference and guidelines for docker compose file](https://docs.docker.com/compose/compose-file/)
