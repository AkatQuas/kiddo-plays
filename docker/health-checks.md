[back to home](./README.md)

## Health checks

Docker monitors the health of your app at a basic level every time you run a container.

Containers run a specific process when they start, which could be the Java or .NET Core runtime, a shell script, or an application binary. Docker checks that the process is still running, and if it stops, the container goes into the exited state.

That gives you a basic health check that works across all environments. Developers can see that their app is unhealthy if the process fails and the container exits.

In a clustered environment, the container platform can restart an exited container or create a replacement container. However, this kind of restarting has nothing todo with container's health.

Docker gives you a neat way to build a real application health check right into the Docker image, just by adding logic to the Dockerfile.

Enter the `HEALTHCHECK` instruction, which you can add to a Dockerfile to tell the runtime exactly how to check whether the app in the container is still healthy. The `HEALTHCHECK` instruction specifies a command for Docker to run inside the container, which will return a status code -- the command can be anything you need to check if your app is healthy. Docker will run that command in the container at a timed interval. If the status code says everything is good, then the container is healthy. If the status code is a failure several times in a row, then the container is marked as unhealthy.

```Dockerfile
HEALTHCHECK CMD curl --fail http://localhost/health

HEALTHCHECK CMD ["<execute-binary>", "<execute-file>", "<options>", "http://localhost/health"]
```

> Use `docker inspect <container>` to check the `Health` field, which indicates the health status of the container.

Would Docker restart or replace the container that is unhealthy? -> The Docker does nothing with it, Docker broadcasts that the container is unhealthy but leaves it as it is. But keep it in mind, the health check continues too, so if the failure is temporary and the next check passes, the container status flips to healthy again.

Health checks become really useful in a cluster with multiple servers running Docker being managed by Docker Swarm or Kubernetes. Then the container platform is notified if the container is unhealthy and it can take action. Because there is additional capacity in a cluster, a replacement container can be started while the unhealthy one is still running, so there shouldn’t be any application downtime.

### Starting containers with dependency checks

Running across a cluster brings new challenges for distributed apps, because you can no longer control the _startup order_ for containers that may have dependencies on each other.

Some apps may have logic built into them to verify that the dependencies they need are there when they start.

You can add that dependency check inside the Docker image. A dependency check is different from a health check -- it runs before the application starts and makes sure everything the app needs is available.

Docker doesn’t have a built-in feature like the `HEALTHCHECK` instruction for dependency checks, but you can put that logic in the startup command.

Any extra tools increase the image size, and they also increase the frequency of updates and the security attack surface. So although curl is a great tool for getting started with container checks, it’s better to write a custom utility for your checks using the same language that your application uses—Java for Java apps, Node.js for Node.js apps, and so on.

There are a whole lot of advantages to this:

- You reduce the software requirements in your image -- you don’t need to install any extra tools, because everything the check utility needs to run is already there for the application.

- You can use more complex conditional logic in your checks with retries or branches, which are harder to express in shell scripts, especially if you’re publishing cross-platform Docker images for Linux and Windows.

- Your utility can use the same application configuration that your app uses, so you don’t end up specifying settings like URLs in several places, with the risk of them getting out of sync.

- You can execute any tests you need, checking database connections or file paths for the existence of certificates that you’re expecting the platform to load into the container -- all using the same libraries your app uses.

## Defining health checks and dependency checks in Docker Compose

Docker Compose can go some of the way toward repairing unreliable applications, but it won’t replace unhealthy containers. But it can set containers to restart if they exit, and it can add a health check if there isn’t one already in the image.

```yaml
# There's no `depends_on` setting, Docker Compose
# could start the containers in any order
version: '3.7'

services:
  numbers-api:
    image: numbers-api
    ports:
      - '8087:80'
    healthcheck: # run the `HEALTHCHECK` command in that container
      interval: 5s # interval between checks
      timeout: 1s # timeout is limited for a single healthcheck
      retries: 2 # maximum failures before the container to be flagged as unhealthy
      start_period: 5s # time to wait before the first health checks
    networks:
      - app-net

  numbers-web:
    image: numbers-web
    restart: on-failure # restart container if exit
    environment:
      - RngApi__Url=http://numbers-api/rng
    ports:
      - '8088:80'
    healthcheck:
      # using the given command, which is not exist in the container Dockerfile
      test: ['CMD', '<execute-cmd>', '<execute-file>', '-option', '']
      interval: 5s
      timeout: 1s
      retries: 2
      start_period: 10s
    networks:
      - app-net

networks:
  app-net:
    external:
      name: nat
```

> Why bother building a dependency check into the container startup when Docker Compose can do it for you with the `depends_on` flag? The answer is that Compose can only manage dependencies on a single machine, and the startup behavior of your app on a production cluster is far less predictable.

## Understanding how checks power self-healing apps

With dependency checks and health checks, we don't require the platform to guarantee the startup order -- the platform could spin up as many as containers on as many servers as quickly as it could. If some of those containers can't reach their dependencies, they fail quickly and get restarted or replaced with other containers.

The idea of self-healing apps is that any transient failuers can be dealt with by the platform. If your app has a nasty bug that causes it to run out of memory, the platform will shut down the container and replace it with a new one that has a fresh allocation of memory. It doesn’t fix the bug, but it keeps the app working correctly.

You do need to be careful with your checks though. Health checks run periodically, so they shouldn’t do too much work. You need to find the balance so checks are testing that key parts of your app are working without taking too long to run or using too much compute resource. Dependency checks only run at startup, so you don’t need to be too concerned about the resources they use, but you need to be careful what you check. Some dependencies are out of your control, and if the platform can’t fix things, it won’t be helpful if your containers fail.

- During the startup life cycle, if the contanier starts and then exists because its dependencies are not available. The platform will try to _restarts the container until it starts correctly_ with its successful dependency checks.

- During the ongoing app life cycle. At some point the app fails, and the health checks fail repeatedly, so the container is flagged as unhealthy. The platform _creates a replacement container_ (maybe on another server) and when that is running correctly, the original unhealthy container is shut down.

## API Reference

[HEALTHCHECK](https://docs.docker.com/engine/reference/builder/#healthcheck)
