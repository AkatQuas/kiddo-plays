[back to home](./README.md)

# Orchestration

Orchestration is about running containerized apps across multiple servers -- a cluster of servers.

An orchestrator is basically a lot of machines all grouped together to form a _cluster_, teh orchestrator manages containers, distributing work among all the machines, load-balancing network traffic, and replacing any containers that become unhealthy.

> Docker Engine will run on every machine in this cluster.

Orchestrators do all the hard work of managing containers, and also providing features for networking, configuring applications, and storing data:

- The cluster API is a secure endpoint for administrators to manage applications.

- Clusters also have a public endpoint for users to access applications on HTTP/HTTPS. This is called _ingress_. External traffic can enter the cluster on any server, and it will be routed to specific containers.

- The cluster can store app configurations and secrets in its own database and deliver them to containers.

- Containers can access each other anywhere on the cluster using standard networking protocols and DNS.

- Clusters can also support shared storage, so containers on any server have access to the same state.

## Service in Docker Swarm

### Setting up a Docker Swarm cluster

Machines in a cluster can have different roles: they can either be a manager or a worker.

The difference between managers and workers is that _the managers run the show_:

- the cluster database is stored on the managers

- you send your commands and YAML files to the API hosted on the managers

- the scheduling and monitoring is all done by the managers

The configuration and state of the _swarm_ is held in a distributed `etcd` database located on all managers. It’s kept in memory and is extremely up-to-date. But the best thing about it is that it requires zero configuration — it’s installed as part of the swarm and just takes care of itself.

Workers typically just run containers when the managers schedule them, and they report back on their status.

Something that’s game changing on the clustering front is the approach to security. Swarm uses TLS to encrypt communications, authenticate nodes, and authorize roles. Automatic key rotation is also thrown in as the icing on the cake.

```bash
# manager
docker swarm init

# join to a swarm as worker/manager
# docker swarm join --help
docker swarm join --token ${TOKEN_VALUE} HOST:PORT

docker swarm update --autolock=true

service docker restart

docker swarm unlock
```

> One of the big advantages of Docker Swarm over Kubernetes is the simplicity of setting up and managing the cluster. You can build a Swarm with dozens of nodes just by installing Docker on every server, running docker swarm init once, and docker swarm join for all the other nodes.

### Running applications as Docker Swarm services

On the application orchestration front, the atomic unit of scheduling on a swarm is the service. This is a new object in the API, introduced along with swarm, and is a higher level construct that wraps some advanced features around containers. These include scaling, rolling updates, and simple rollbacks.

You don't run containers directly in Docker Swarm. Instead you deploy services, and the Swarm runs containers for you.

```bash
# one service is for only one IMAGE
docker service create [OPTIONS] IMAGE [COMMAND] [ARG...]

docker service ls

docker service ps SERVICE_NAME/SERVICE_ID

docker service inspect SERVICE_NAME/SERVICE_ID

docker service scale SERVICE=REPLICAS

docker service rm SERVICE
```

Services are defined with a lot of the same information you use to run containers. You specify the image to use, environment variables to set, ports to publish, and a name for the service that becomes its DNS name on the network.

The difference is that a service can have many replicas: individual containers that all use the same specification from the service and can be run on any node in the Swarm.

The containers that make up a service are called replicas, but they’re just ordinary Docker containers.

You can connect to the node that’s running a replica and work with it using the usual Docker container commands.

> This is one of the big differences between Docker Swarm and Docker Compose, which doesn’t have a data store for application definitions. You can only manage applications with Docker Compose if you have the Compose file(s) available, because that’s the source of the app definition. In Swarm mode the app definition is stored in the cluster, so you can manage apps without a local YAML file.

All _services_ are constantly monitored by the swarm -- the swarm runs a background _reconciliation loop_ that constantly compares the _observed state_ of the service with the _desired state_. If the two states match, the world is a happy place and no further action is needed. If they don’t match, swarm takes actions to bring observed state into line with desired state.

```bash
# update a service on the fly
docker service update [OPTIONS] SERVICE
```

All container orchestrators use the approach of staged rollouts for application updates, which keeps your app online during the upgrade. Swarm implements this by replacing replicas one at a time, so if you have multiple replicas hosting your application, there are always containers running to service incoming requests.

Swarm also stores the previous specification of a service in its database, so if you need to manually roll back to the previous version, you can do that with a single command.

```bash
# rollback to the previous service specification
docker service update --rollback SERVICE
```

### Managing network traffic in the cluster

Networking in Swarm mode is standard TCP/IP, as far as the applications inside containers are concerned. Components look for each other by DNS name, the DNS server in Docker returns an IP address, and the container sends network traffic to that IP address. Ultimately the traffic is received by a container and it responds.

```bash
# create a network using overlay driver
docker network create --driver overlay NETWORK_NAME
```

Swarm mode provides a new type of Docker network called the overlay network. It’s a virtual network that spans all the nodes in the cluster, and when services are attached to the same overlay network, they can communicate with each other using the service name as the DNS name, even if they're running on different servers/nodes.

A DNS query to Docker for that Compose service will return the IP addresses for all the containers, and it will rely on the consumer to pick one to send the traffic to. That doesn’t scale well when you have hundreds of replicas in a Swarm service, so overlay networks use a different approach and return _a single virtual IP address_ for the service.

The easiest way to see the virtual IP address (this is called VIP networking) is to connect to a terminal session in any of the container replicas. You can run some network commands to perform DNS queries on the service names and check what IP addresses are returned.

> This is VIP networking, which is supported in Linux and Windows and is a much more efficient way to load-balance network traffic. There is a single IP address from the DNS lookup, which stays constant even when the service is scaled up or down. Clients send traffic to that IP address, and the networking layer in the operating system discovers there are actually multiple destinations for the address, and it decides which one to use.

Swarm uses _ingress networking_ to deal with multiple nodes and multiple applications: every node listening on the same port externally and Docker directing traffic internally within the cluster.

> When a request comes into ingress via certain port, Docker Swarm uses ingress networking to route the traffic. If traffic hits a node that is running containers (one or some), the requests get load-balanced among these. If the traffic hits empty because no container is running on the node, the node would transparently forwards it to a node that capable.

## Distributed applications in Docker Swarm

In a real system, you'll describe your application in a YAML file that you’ll send to the swarm manager, which will then decide what actions to take to get the application running.

They also provide a simple way to deploy the app and manage its entire lifecycle — _initial deployment_ > _health checks_ > _scaling_ > _updates_ > _rollbacks_ and more!

### Docker Compose for production deployments

You deploy applications in Swarm mode by creating a _stack_, which is just a resource that groups together lots of other resources, such as services, networks, and volumes.

Stack are the first-class resource in Swarm mode.

```bash
# deploy the stack from the Compose file:
docker stack deploy -c PATH_TO_COMPOSE_FILE STACK_NAME

# deploy an updated Compose file for the stack with same name
docker stack deploy -c PATH_TO_NEW_COMPOSE_FILE STACK_NAME

# details about a particular stack
docker stack ps STACK_NAME
```

> Stack deployment doesn't support multiple Compose files like Docker Compose. So first you may need several Compose files. Or you can generate Compose file from multiple Compose files using `docker-compose -f compose-dev.yml -f compose-prod.yml > stack.yml`.

A complete example Compose file for deploying as a stack.

```yaml
version: '3.7'

services:
  todo-web:
    image: todo-list
    ports:
      - '8080:80' # default mode is _ingress mode_
      - target: 443
        published: 443
        mode: host # using _host mode_

    configs:
      # Services consume config objects by specifying them in the Compose file.
      # The formation should be consistent. JSON for json file, YAML for yml file.
      - source: todo-list-config
        target: /app/config/config.json

    secrets:
      # Services consume encrypted secrets objects by specifying them in the Compose file.
      # The formation should be consistent. JSON for json file, YAML for yml file.
      - source: todo-list-secret
        target: /app/config/secrets.json
    # optional configuration for stack deploying
    #  which only make sense when running in a cluster
    deploy:
      replicas: 1
      resources:
        limits:
          cpus: '0.50'
          memory: 100M
    networks:
      - app-net

  todo-db:
    image: postgres:11.6
    environment:
      PGDATA: '/var/lib/postgresql/data/pgdata'
    volumes:
      - todo-db-data:/var/lib/postgresql/data
    deploy:
      replicas: 1
      resources:
        limits:
          cpus: '0.50'
          memory: 500M
      placement:
        # only running container in this node,
        #     whose `labels.storage` being "raid"
        constraints:
          - node.labels.storage == raid
          - node.role == worker
          - node.id == <node-id>
          - node.hostname == <host-name>
          - node.role != manager
          - node.labels.zone == production
    networks:
      - app-net

  appserver:
    image: tode-server
    networks:
      - app-net
      - payment
    deploy:
      replicas: 2
      update_config:
        paralleism: 2
        failure_action: rollback
      placement:
        constraints:
          - 'node.role == worker'
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
    secrets:
      - postgres_password

  visualizer:
    image: dockersamples/visualizer:stable
    ports:
      - '8001:8080'
    # SIGTERM to process(PID 1), after `grace_period` time, SIGKILL
    stop_grace_period: 1m30s
    volumes:
      - '/var/run/docker.sock:/var/run/docker.sock'
    deploy:
      update_config:
        failure_action: rollback
      placement:
        constraints:
          - 'node.role == manager'

# external config objects
configs:
  todo-list-config:
    external: true

secrets:
  postgres_password:
    external: true
  todo-list-secret:
    external: true

networks:
  app-net:
  out-net:
    external: true
  payment:
    driver: overlay
    driver_opts:
      encrypted: 'yes'

volumes:
  todo-db-data:
```

> Docker containers can access all the host machine’s CPU and memory if you don’t specify a limit. In production, you want limits to safeguard against bad code or malicious users trying to max out your system, but those limits are established only when the container starts, so if you update them you get a new container, which is a replica update in Swarm mode.

Swarm stacks are a neat way of grouping applications, which you need because a cluster will typically run many apps. You can manage applications as a whole using the stack commands in the Docker CLI, listing the individual services and the service replicas or removing the app altogether.

> You can manage all the resources in a stack without needing the Compose file, because all the specifications are stored inside the cluster database. That shared database is replicated between the Swarm managers, so it’s a safe place to store other resources too. It’s how you’ll store application configuration files in the Swarm, which you can make available to services in your Compose file.

### Managing app configuration with config objects

Apps running in containers need to be able to load their configuration settings from the platform that is running the container.

> - The Docker image is packed with default config for the dev environment.
>
> - In test, the defaults are overridden with environment variables and local files.
>
> - In production, the app config is loaded from config objects and secrets stored in the Swarm.

Configuration is such a critical part of deployment that all the orchestrators have a first-class resource to hold application configuration.

Docker Swarm supports that workflow with a specific type of resource, as config objects, that you load into the cluster from an existing configuration file.

```bash
# create the config object from a local JSON file
docker config create todo-list-config ./path/to/config.json

docker config inspect --pretty todo-list-config
```

Config objects are created with a name and the path to the config file contents, be it in the formation of JSON, XML, key/value pairs.

> Config objects are not meant for sensitive data. The file content is not encrypted it the Swarm database, nor is it encrypted in transit as it moves frome the managers to the working nodes.
>
> You'd better no to store database connection strings, URLs for production services and API keys.

### Managing confidential settings with secrets

Secrets are a resource in the Swarm that the cluster manages, and they work almost exactly like config objects.

You create secrets from a local file, and that gets stored in the cluster database. Then you reference the secret in a service specification, and the contents of the secret get loaded into the container filesystem at runtime.

> The key difference with secrets is that you can only read them in plain text at one point in the workflow: inside the container when they are loaded from the Swarm. So you can’t read the contents of the secret once it’s been stored.

Secrets and config objects are stored in the managers’ distributed database and are available to every node.

One thing you do need to understand about config objects and secrets: _they can’t be updated_ in Docker Swarm. When you create them in the cluster, the contents will _always be the same_, and if you need to update the config for an application, you need to replace it:

1. create a new config/secret object,

1. configure the services to use the new object,

1. deploy the stack using updated Compose file.

### Storing data with volumes in the Swarm

Volumes appear as part of the container’s filesystem but they’re actually stored outside of the container. Application upgrades replace the container and attach the volume to the new container, so the new container starts with all the data the previous container had.

> Default volumes persist when the stack is removed.

You can pin services to specific nodes, which means updates will always run on the node that has the data. That works for scenarios where you want application data to be stored outside of the container so it survives updates, but where you don’t need to run multiple replicas and you don’t need to allow for server failure. You apply a label to your node, and in your Compose file you restrict replicas to running on that node.

> This deployment provides guarantees for data availability, if the labeled node itself is available. If the container fails its health checks and gets replaced, the new replica will run on the same node as the previous replica and attach to the same named volume. When you update the database service specification, you get the same guarantees.

```bash
# find the ID for one node, and update it, adding a label:
docker node update --label-add storage=raid $(docker node ls -q)

# adding `zone` label with value "production"
docker node update --label-add zone=production NODE_NAME
```

Applications that use disk as a data cache will be fine with local volumes, as the data can be different for each replica, but that won’t work for apps that need to access shared state across the cluster.

> Docker has a plugin system for volume drivers, so Swarms can be configured to provide distributed storage using a cloud storage system or a storage device in the datacenter. Configuring those volumes depends on the infrastructure you're using, but you consume them in the same way, attaching volumes to services.

### Understanding how the cluster manage stacks

Stacks in Docker Swarm are just groups of resources that the cluster manages for you:

- ingress network
- services, aka containers
- secret objects, config objects, networks
- volumes

There are a few takeaways:

- Volumes can be created and removed by the Swarm. Stacks will create a default volume if the service image specifies one, and that volume will be removed when the stack is removed. If you specify a named volume for the stack, it will be created when you deploy, but it won't be removed when you delete the stack.

- Secrets and configs are created when an external file gets uploaded to the cluster. They’re stored in the cluster database and delivered to containers where the service definition requires them. They are effectively write-once read-many objects and can't be updated.

- Networks can be managed independently of applications, with admins explicitly creating networks for applications to use, or they can be managed by the Swarm, which will create and remove them when necessary. Every stack will be deployed with a network to attach services to, even if one is not specified in the Compose file.

- Services are created or removed when stacks are deployed, and while they’re running, the Swarm monitors them constantly to ensure the desired service level is being met. Replicas that fail health checks get replaced, as do replicas that get lost when nodes go offline.

Stack is a logical group of components that make up an application, but it doesn’t map out a dependency graph between services. You need to assume that your components will start in a random order, and capture health and dependency checks in your images so containers fail fast if the application can’t run. That way the cluster can repair the damage by restarting or replacing containers, and that gets you a self-healing app

## Automating release with upgrades and rollbacks

### The application upgrade process with Docker

There are at least four deployment cadences you need to consider. First there's _the application_ and its _dependencies_, then the _SDK_ that compiles the app, then the _application platform_ it runs on, and finally the _operating system_ itself.

The build pipeline is the heart of the project. The pipeline should run every time a change to the source code is pushed. You only get confindence when releases are successful, and that's where application health checks become critical. Without them, you don't have a self-healing app, and that means you can't have safe updates and rollbacks.

There are some fields which configure the global service:

- `mode: global`: This setting in the `deploy` section configures the deployment to run one container on every node in the Swarm. The number of replicas will equal the number of nodes, and if any nodes join, they will also run a container for the service.

- `mode:host`: This setting in the `ports` section configures the service to bind directly to port on the host, and not use the ingress network. This can be a useful pattern if the web apps are lightweight enough that only one replica is need for each node, but network performance is critical so you don't want the overhead of routing in the ingress network.

> Service updates are always done as a staged rollout, and the default is to stop existing containers before starting new ones, freeing the host port to let the new comers take over.

Docker Swarm uses cautious defaults for the rollout of service updates. It updates one replica at a time and ensures the container starts correctly before moving on to the next replica.

Services roll out by stopping existing containers before starting replacements, and if the update fails because new containers don’t start correctly, the rollout is paused.

Some properties of the update configuration section change how the rollout works:

```yaml
numbers-api:
  deploy:
    update_config:
      parallelism: 3
      monitor: 60s
      failure_action: rollback
      order: start-first
```

- `parallelism` is the number of replicas that are replaced in parallel. The default is 1, so updates roll out by one container at a time. The bigger number gives you a faster rollout and a greater chance of finding failures, because there are more of the new replicas running.

- `monitor` is thh time period the Swarm should wait to monitor new replicas before continuing with the rollout. The default is 0, and you definitely want to change that if your images have health checks, because the Swarm will monitor health checks for this amount of time. This increase confidence in the rollout.

- `failure_action` is the action to take if the rollout fails because containers don't start or fail health checks within `monitor` period. The default is to pause the rollout, but you can set it to automatically roll back to the previous version.

- `order`: is the order of replacing replicas. `stop-first` is the default, and it ensures there are never more replicas running than the required number. Buti if if your app can work with extra replicas, `start-first` is better because new replicas are created and checked before the old ones are removed.

Parallelism can be set to around 30% of the full replica count so your update happens fairly quickly, but you should have a monitor period long enough to run multiple health checks, so the next set of tasks only get updated if the previous update worked.

> There’s one important thing to keep in mind: when you deploy changes to a stack, _the update configuration gets applied first_. Then, if your deployment also includes service updates, the rollout will happen using the new update configuration.
>
> And the update configuration settings should be include for every subsequent deployment. If you forget to include these settings, Docker Swarm will revert the service back with the default update settings.

```bash
# view the update status of some service/container
docker service inspect --pretty CONTAINER_NAME
```

### Configuring service rollbacks

There is no `docker stack rollback` command; only individual services can be rolled back to their previous state.

Rollbacks should happen automatically when the cluster is performing a rollout and it identifies that new replicas are failing within the monitor period.

If any new replicas report as unhealthy during the monitor period of the rollout, that triggers the rollback action.

> Using the `start-first` rollout strategy helps with keeping the app running. If I used the default `stop-first`, there would be a period of reduced capacity when three v3 replicas get stopped, then three v5 replicas get started and fail. In the time it takes the new replicas to flag themselves as unhealthy and for the rollback to complete, there would only be three active replicas of the API. Users wouldn’t see any errors because Docker Swarm doesn’t send any traffic to replicas that aren’t healthy, but the API would be running at 50% capacity.

Typically you’d have the core Compose file, an environment override file, and possibly a version override file.

Failing health checks don't cause a rollback of the last update; they just trigger replacement replicas _unless the failure happens during the monitor period of the update_.

<details>
<summary>
An example Compose file with comments.
</summary>

```yaml
networks:
  app-net:
    name: numbers-prod
services:
  numbers-api:
    deploy:
      replicas: 6
      resources:
        limits:
          cpus: 0.5
          memory: 75M
      rollback_config:
        # The goal here is to revert back as quickly as possible
        failure_action: continue
        # replicas of the old version will be started before the rollback worries about shutting down replicas of the new version
        order: start-first
        # all the failed replicas will be replaced in one go
        parallelism: 6
      update_config:
        failure_action: rollback # rollback if the rollout fails
        monitor: 60s
        order: start-first # using `start-first` instead of `stop-first`
        parallelism: 3
    environment:
      Broken: 'false'
    healthcheck:
      interval: 2s
      retries: 2
      start_period: 5s
      test:
        - CMD
        - dotnet
        - Utilities.HttpCheck.dll
        - -u
        - http://localhost/health
        - -t
        - '500'
      timeout: 3s
    image: diamol/ch14-numbers-api:v5
    networks:
      app-net: {}
  numbers-web:
    deploy:
      mode: global
      resources:
        limits:
          cpus: 0.75
          memory: 150M
    environment:
      RngApi__Url: http://numbers-api/rng
    healthcheck:
      interval: 20s
      retries: 3
      start_period: 30s
      timeout: 10s
    image: diamol/ch14-numbers-web:v5
    networks:
      app-net: {}
    ports:
      - mode: host
        published: 80
        target: 80
version: '3.7'
```

High-availability which health check, update config that is fast but safe, rollback config that is just fast.

```yml
version: '3.7'

services:
  accesslog:
    image: access-log
    networks:
      - app-net

  iotd:
    image: image-of-the-day
    ports:
      - 8088:80
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost/image']
      interval: 5s
      timeout: 20s
      retries: 2
      start_period: 10s
    deploy:
      replicas: 4
      update_config:
        parallelism: 2
        order: start-first
        monitor: 90s
        failure_action: rollback
      rollback_config:
        parallelism: 4
        order: start-first
        failure_action: continue
    networks:
      - app-net

  image-gallery:
    image: image-gallery
    ports:
      - 80:80
    networks:
      - app-net

networks:
  app-net:
    name: image-gallery-prod
```

</details>

### Managing downtime for the cluster

Maintenance mode for nodes in the Swarm is called _drain mode_, and you can put managers or workers into drain.

```bash
# set a work or manager into drain mode
docker node update --availability drain NODE_NAME
```

Drain mode means slightly different things for workers and managers. In both cases all the replicas running on the node are shut down and no more replicas will be scheduled for the node. Manager nodes are still part of the management group though, so they still synchronize the cluster database, provide access to the management API, and can be the leader.

What's is a _leader manager_? Multiple managers are needed for high availability, but it’s an active-passive model. Only one manager is actually controlling the cluster, and that’s the leader. The others keep a replica of the cluster database, they can action API requests, and they can take over if the leader fails. That happens with an election process between the remaining managers, which requires a majority vote, and for that you always need an odd number of managers—typically three for smaller clusters and five for large clusters.

If you permanently lose a manager node and find yourself with an even number of managers, you can promote a worker node to become a manager instead.

```bash
# promote the worker to a manager
docker node promote WORKER_NODE
```

If the node comes back, you could return one of the other managers to the worker pool by running `docker node demote`.

Some takeaway tips:

- **All managers go offline**: If all your managers go offline but the worker nodes are still running, then your apps are still running. The ingress network and all the service replicas on the worker nodes work in the same way if there are no managers, but now there’s nothing to monitor your services, so if a container fails it won’t be replaced. You need to fix this and bring managers online to make the cluster healthy again.

- **Leader and all but one manager go offline**: It’s possible to lose control of your cluster if all but one manager node goes offline and the remaining manager is not the leader. Managers have to vote for a new leader, and if there are no other managers, a leader can’t be elected. You can fix this by running swarm init on the remaining manager with the `force-new-cluster` argument. That makes this node the leader but preserves all the cluster data and all the running tasks. Then you can add more managers to restore high availability.

- **Rebalancing replicas for even distribution**: Service replicas don’t automatically get redistributed when you add new nodes. If you increase the capacity of your cluster with new nodes but don’t update any services, the new nodes won’t run any replicas. You can rebalance replicas so they’re evenly distributed around the cluster by running `service update --force` without changing any other properties.

### Understanding high availability in Swarm cluster

There are multiple layers in your app deployment where you need to consider high availability:

- health checks tell the cluster if your app is working, and the cluster will replace failed containers to keep the app online;

- multiple worker nodes provide extra capacity for containers to be rescheduled if a node goes offline;

- multiple managers provide redundancy for scheduling containers and monitoring workers;

- multiple clusters in different regions to achieve datacenter redundancy;

### Backing up Swarm

Backing up a swarm will backup the control plane objects required to recover the swarm in the event of a catastrophic failure of corruption, though recovering a swarm from backup is an extremely rare scenario.

> Managing your swarm and applications declaratively is a great way to prevent the need to recover from a backup. You can just start the application with that same configuration file.

Swarm configuration and state is stored in `/var/lib/docker/swarm` on every manager node. The configuration includes; Raft log keys, overlay networks, Secrets, Configs, Services, and more. **A swarm backup is a copy of all the files in this directory**.

As the contents of this directory are replicated to all managers, you can, and should, perform backups from multiple managers.

However, as you have to stop the Docker daemon on the node you are backing up, it’s a good idea to perform the backup from non-leader managers. This is because stopping Docker on the leader will initiate a leader election.

You should also perform the backup at a quiet time for the business, as stopping a manager can increase the risk of the swarm losing quorum if another manager fails during the backup.

Steps to perform test backup, just for demonstration.

1. Stop Docker on a _non-leader_ swarm manager.

   `service docker stop`. If you have any containers or service tasks running on the node, this action may stop them.

1. Backup the Swarm config.

   `tar -czvf swarm.bkp /var/lib/docker/swarm/`. This uses the Linux `tar` utility to perform the file copy that will be the backup.

1. Verify the backup file exists.

   `ls -l`. In the real world you should store and rotate this backup in accordance with any corporate backup policies. At this point, the swarm is backed up and you can restart Docker on the node.

1. Restart Docker

   `service docker restart`

Perform the following tasks from the swarm manager node that you wish to recover. Remember that Docker must be stopped and the contents of `/var/lib/docker/swarm` must be deleted.

1. Restore the Swarm configuration from backup.

   `tar -zxvf swarm.bkp -C /`. Restoring to the root directory is required with this command as it will include the full path to the original files as part of the extract operation. This may be different in your environment.

1. Start Docker.

   `service docker start`

1. Initialize a new Swarm cluster

   `docker swarm init --force-new-cluster`. Remember, you are not recovering a manager and adding it back to a working cluster. This operation is to recover a failed swarm that has no surviving managers. The `--force-new-cluster` flag tells Docker to create a new cluster using the configuration stored in `/var/lib/docker/swarm/` that you recovered in step 1.

1. Check that the network and service were recovered as part of the operation.

   `docker network ls`, `docker secret ls`.

1. Add new manager and worker nodes and take fresh backups.
