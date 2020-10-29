[back to home](./README.md)

# Automation

## Continuous Integration

Continuous integration is an automated process that runs regularly to build applications and execute a suite of tests.

The CI process is a pipeline that starts with code, executes a set of steps, and finishes with a tested deployable artifact. One of the challenges with CI is that pipelines become unique for each project—different technology stacks do different things in the steps and produce different types of artifacts.

Docker brings consistency to the CI process because every project follows the same steps and produces the same type of artifact.

> Each step in the CI pipeline runs with Docker or Docker Compose, and all the work happens inside containers.
>
> You use containers to compile applications, so the CI server doesn’t need to have any programming languages or build SDKs installed. Automated unit tests run as part of the image build, so if the code is broken, the build fails and the CI job stops. You can also run more sophisticated end-to-end tests by starting the whole application with Docker Compose alongside a separate container that runs tests to simulate user workflows.

In a Dockerized CI process, all the hard work happens in containers, but you still need some infrastructure components to hold everything together: a centralized source code system, a Docker registry to store images, and an automation server to run the CI jobs.

### A basic build system

Some basic components you need to construct a build system with Docker. All of them could be running in the same Docker Engine if you run these components is same docker-compose.

- Source code: GitLab, Gogs, GitHub

- Docker registry: for distributing the built images, as well as storing

- Automation server: Jenkins

> Jenkins connects to the Docker Engine to run Docker and Docker Compose commands, and it can connect to the Git server and the Docker registry by DNS because they’re all containers in the same Docker network.

The CI process runs a single command to build the application, and all the complexity of the build is captured in Dockerfiles and Docker Compose files.
