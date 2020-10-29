[back to home](./README.md)

## Remote access

Remote access is how you administer test environments or debug issues in production, and it’s also how you enable the _continuous deployment_ part of your CI/CD pipeline. Continuous deployment is the next stage of the pipeline -- connecting to a remote Docker Engine and deploying the new version of the app.

### Endpoint options for the Docker API

The default setup is for the Engine to listen on a local channel, and for the command line to use that same channel. The local channel uses either Linux _sockets_ or Windows named _pipes_, and those are both network technologies that restrict traffic to the local machine.

```json
{
  "hosts": [
    // enable remote access on port 2375
    "tcp://0.0.0.0:2375"
    // keep listening on the local channel, Linux socket
    "fd://"
    // keep listening on the local channel, Windows pipe
    "npipe://"
  ],
  "insecure-registries": [
    "https://hub-mirror.c.163.com/"
  ]
}
```

The Docker and Docker Compose command lines both support a `host` parameter, which specifies the address of the Docker Engine where you want to send commands.

```bash
docker --host tcp://localhost:2375 image ls

curl http://localhost:2375/containers/json
```

When you’re working with a remote Docker Engine, any commands you send work in the context of that machine. So if you run a container and mount a volume from _the local disk_, it’s the _remote machine’s disk_ that the container sees.

### Configuring Docker for secure remote access

Docker supports two other channels for the API to listen on, and both are secure.

- Transport Layer Security (TLS): the same encryption technique based on digital certificates used by HTTPS websites. The Docker API uses _mutual TLS_, so the server has a certificate to identify itself and encrypt traffic, and the client also has a certificate to identify itself.

- Secure Shell (SSH) protocol: it is the standard way to connect to Linux servers, but it is also supported in Windows. SSH users can authenticate with username and password or with private keys.

### Using Docker Contexts to work with remote engines

You can point your local Docker CLI to a remote machine using the `host` parameter, along with all the TLS cert paths if you’re using a secured channel, but it’s awkward to do that for every command you run. Docker makes it easier to switch between Docker Engines using Contexts.

You create a Docker Context using the CLI, specifying all the connection details for the Engine. You can create multiple contexts, and all the connection details for each context are stored on your local machine.

```bash
# create a context using your PWD domain and certs:
docker context create pwd-tls --docker "host=tcp://$pwdDomain,ca=/tmp/pwd-certs/ca.pem,cert=/tmp/pwd-certs/client-cert.pem,key=/tmp/pwd-certs/client-key.pem"

# for SSH it would be:
docker context create local-tls --docker "host=ssh://user@server"

# list contexts:
docker context ls

# switch contexts, system-wide default,
docker context use CONTEXT

# using context in current terminal session, temporarily
export DOCKER_CONTEXT='some-context'
```

### Adding continuous deployment to the CI pipeline

That pipeline covered the continuous integration (CI) stages—building and testing the app in containers and pushing the built image to a Docker registry. The continuous Deployment (CD) stages add to that, deploying to a testing environment for final signoff and then to production.

Most automation servers let you store secrets inside the build server and use them in pipeline jobs, and that separates credential management from source control.

### Understanding teh access model for Docker

Securing your Engine is about two things: encrypting the traffic between the CLI and API, and authenticating to ensure the user is allowed access to the API.

There’s no authorization—the access model is all or nothing. If you can’t connect to the API, you can’t do anything, and if you can connect to the API, you can do everything.

Kubernetes has a role-based access control model, as does Docker Enterprise, so you can restrict which users can access resources, and what they can do with those resources.
