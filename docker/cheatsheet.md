## docker system

```bash
# show disk usage in Docker
docker system df

```

## docker

```bash
# build images from configuration file
docker build -t <tag> -f <path/to/Dockerfile> .

# files copying between host and containers
docker cp host_source_path container:destination_path

docker cp container:source_path host_destination_path


# interactive with exisiting container
docker exec -it <container> bash

docker container run --interactive --tty <container>


# list the processes running in the container
docker container top <container-name/container-id>


# run container with environment variables
docker container run --env VAR=VAL VAR=VAL <image-name>


# display any log entries the container
docker container logs <container-name/container-id>


# show the details of a container
docker container inspect <container-name/container-id>


# show images history
docker image history <image>


# run images interactively
docker run -it <image>


# remove container automatically when it exit
## using --rm
docker run --rm <image>

## clear exited containers
docker rm $(docker ps -a -q -f status=exited)

docker container rm -f $(docker container ls -aq)

docker container rm --force $(docker container ls --all --quiet)

docker image rm -f $(docker image ls -f reference='' -q)

# in higher version
docker container prune


# give an port automatically to container
docker run -d -P --name <GIVEN CONTAINER NAME> <image>


# specify a port to a container
docker container run --publish <host port>:<container port> <webapp image>

# background job
docker container run --detach --publish <host port>:<container port> <webapp image>


# This would kill all the containers and remove all data volumes if there any. Then we need to remove the network
docker network rm <network-name>

# list all the network we have now,
docker network ls

# inspect a network
docker network inspect <network-name>
```

## docker-compose

```bash
# launch a composed application:
# `-v` means verbose, `-d` means detaching from terminal.
docker-compose up -v -d

# stop and remove a composed application
# remove all the containers, networks, volumes
docker-compose down -v

# check the network running
docker-compose ps
```
