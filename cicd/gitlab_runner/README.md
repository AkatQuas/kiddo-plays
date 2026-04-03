# Full Docker Compose Setup for GitLab

This guide covers setting up GitLab CE using Docker Compose and registering runners for CI/CD.

## Prerequisites

- Docker and Docker Compose installed
- At least 4GB RAM available (GitLab recommends 4GB minimum)
- A machine with a static IP accessible from your network

## Quick Start

```bash
# 1. Set environment variables
export HOST_IP="10.1.71.221"        # Your server IP
export GITLAB_HOME="$HOME/gitlab"   # Local directory for GitLab data

# 2. Create gitlab home directory
mkdir -p $GITLAB_HOME

# 3. Start GitLab and Runner
./compose.sh

# 4. Check status (GitLab takes 2-5 minutes to start)
docker compose ps
```

## Configuration

This is an example docker-compose.yaml used by [compose.sh](./compose.sh).

```yaml
services:
  gitlab:
    # community edition
    image: gitlab/gitlab-ce:18.9.3-ce.0
    container_name: gitlab
    restart: always
    hostname: '$HOST_IP'
    environment:
      GITLAB_OMNIBUS_CONFIG: |
        # GitLab external URL (change IP to match your host)
        external_url 'http://$HOST_IP:6060'

        # SSH port for git operations
        gitlab_rails['gitlab_shell_ssh_port'] = 2224

        # Performance tuning (adjust based on available resources)
        puma['worker_processes'] = 2
        sidekiq['max_concurrency'] = 10
    ports:
      - '6060:6060' # Web UI
      - '4443:443'
      - '2224:22' # SSH for git
    volumes:
      - '$GITLAB_HOME/config:/etc/gitlab'
      - '$GITLAB_HOME/logs:/var/log/gitlab'
      - '$GITLAB_HOME/data:/var/opt/gitlab'
    shm_size: '512m'
    network_mode: host

  gitlab_runner:
    # choose community edition
    image: gitlab/gitlab-runner:v18.9.0
    container_name: gitlab_runner
    restart: always
    depends_on:
      - gitlab
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - $GITLAB_HOME/gitlab-runner-config:/etc/gitlab-runner
    # networks:
    #   - gitlab_network
    network_mode: host
```

### Configuration Notes

| Setting                      | Description                                   | Default  |
| ---------------------------- | --------------------------------------------- | -------- |
| `external_url`               | GitLab web access URL                         | Required |
| `gitlab_shell_ssh_port`      | SSH port for git clone/push                   | 22       |
| `puma['worker_processes']`   | Web server workers                            | 2        |
| `sidekiq['max_concurrency']` | Background job concurrency                    | 10       |
| `shm_size`                   | Shared memory for GitLab                      | 256m     |
| `network_mode: host`         | Use host networking (required for this setup) | -        |

## Initial Setup

### Access GitLab Web UI

Open browser to: **http://$HOST_IP:6060**

### Get Admin Password

Get the initial admin password for user `root`. Change the password after first login.

```bash
docker exec -it gitlab grep 'Password:' /etc/gitlab/initial_root_password

# Example output:
# Password: your-password-here
```

### Create Runner Authentication Token

1. Go to **Admin Area → CI/CD → Runners**
2. Click **New instance runner**
3. Copy the authentication token (it's for runner registration)

## Register GitLab Runners

### Option 1: macOS Runner (Homebrew)

Install and register a runner on your macOS host:

```bash
# Install gitlab-runner
brew install gitlab-runner

# Start as background service
brew services start gitlab-runner

# Register runner (replace TOKEN with your authentication token)
gitlab-runner register --token <TOKEN>
```

When prompted:

- **Runner executor**: `shell` or `docker`
- **Tag list**: `macos`

### Option 2: Docker Runner

Run GitLab Runner in a Docker container:

```bash
# Start runner container
docker run -d --name gitlab-runner \
  --restart always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /path/to/gitlab-runner-config:/etc/gitlab-runner \
  gitlab/gitlab-runner:latest

# Register the runner
docker exec -it gitlab-runner gitlab-runner register --token <TOKEN>
```

When prompted:

- **Runner executor**: `docker`
- **Docker image**: `node:22-slim` (or your preferred image)
- **Tag list**: `docker`

### Runner Configuration

An example [config.toml](./gitlab-runner/config.toml) is provided.

For Docker executor, use `pull_policy = ["if-not-present"]` to reuse cached images instead of pulling every time.

### Pull Helper Image (First Run)

On first job execution, the runner will attempt to pull a helper image. If jobs fail, the error message will show the exact image to pull.

```bash
# Pull the helper image manually if jobs fail:
docker pull registry.gitlab.com/gitlab-org/gitlab-runner/gitlab-runner-helper:x86_64-v18.9.0

# Pre-pull common CI images to avoid delays:
# docker pull node:22-slim
# docker pull python:3.11-slim
```

## CI/CD Configuration for Repository

### Using `.gitlab-ci.yml`

GitLab automatically uses `.gitlab-ci.yml` in your repository root.

### Custom CI File Path

To use a different file or location:

1. Go to **Project → Settings → CI/CD → General pipelines**, [documentation](https://docs.gitlab.com/ci/pipelines/settings/#custom-cicd-configuration-file-examples)
2. Under **CI/CD configuration file**, specify custom path
3. Example: `https://raw.githubusercontent.com/username/repo/main/.gitlab-ci.yml`

### Disable Default Clone

To manually clone during job execution, add to your CI file:

```yaml
variables:
  GIT_STRATEGY: none

build_app:
  stage: build
  before_script:
    - git clone $CI_REPOSITORY_URL repo
    - cd repo
  script:
    - npm install
    - npm run build
  tags:
    - docker
```

See [gitlab-ci.template.yml](./gitlab-ci.template.yml) for a complete example.

## Common Tasks

### Update GitLab

```bash
export HOST_IP="10.1.71.221"
export GITLAB_HOME="$HOME/gitlab"

docker compose down
docker compose pull
docker compose up -d
```

### Backup Data

```bash
# Backup configuration and data
tar -czf gitlab-backup-$(date +%Y%m%d).tar.gz $GITLAB_HOME/
```

## Pipeline Trigger via Webhook

Trigger a pipeline remotely using the [GitLab Trigger API](https://docs.gitlab.com/ci/triggers/#use-a-webhook):

```bash
curl --request POST \
  --url 'http://${HOST_IP}:6060/api/v4/projects/${PROJECT_ID}/ref/main/trigger?token=${TRIGGER_TOKEN}&variables[VARIABLE_NAME]=value'
```

Example with multiple variables:

```bash
curl --request POST \
  --url 'http://10.1.70.220:6060/api/v4/projects/2/ref/main/trigger?token=<trigger-token>&variables[VAR_1]=true&variables[BRANCH]=release/abc'
```

### Create a Pipeline Trigger Token

1. Go to **Project → Settings → CI/CD → Pipeline triggers**
2. Click **Add trigger**
3. Copy the token for use in API calls

This is useful for integrating with external systems (Bitbucket, GitHub, cron jobs, etc.).

## Troubleshooting

### Runner Not Picking Up Jobs

1. Check runner is online: **Admin Area → CI/CD → Runners**
2. Verify tags match your CI job tags
3. Check runner is enabled for the project

### Jobs Stuck in Pending

1. Verify at least one runner is available
2. Check runner has matching tags
3. Review runner logs: `docker logs gitlab-runner`
