# Dev Container

Read documents

1. [basic](https://code.visualstudio.com/docs/devcontainers/containers)

1. [advanced](https://code.visualstudio.com/remote/advancedcontainers/overview)

It's not easy to share terminal profile, use [dotfiles](https://code.visualstudio.com/docs/devcontainers/containers#_personalizing-with-dotfile-repositories) to do this!

# Open Local repository in DevContainer

Open VS Code command palette, select one of the commands:

- Dev Containers: Open Folder in Container...
- Dev Containers: Open Workspace in Container...

Choose a folder that contains the configuration folder `.devcontainer`.

Otherwise, follow the prompt to create a new one.

# Open a Remote repository in DevContainer

- Dev Containers: Clone Repository in Container Volume...
- Dev Containers: Clone Repository in Named Container Volume...

By default, this would clone projects hosted on GitHub, and all source codes are cloned in Volume.

## Disconnect from Dev Container

Open VS Code command palette, run:

- Remote: Close Remote Connection

## Sharing SSH keys

1. Startup with **ssh-agent** in local machine

First, start the SSH Agent in the background by running the following in a terminal:

```bash
# in local machine
eval "$(ssh-agent -s)"
```

Then add these lines to your `~/.bash_profile` or `~/.zprofile (for Zsh)` so it starts on login:

```bash
# in local machine
if [ -z "$SSH_AUTH_SOCK" ]; then
   # Check for a currently running instance of the agent
   RUNNING_AGENT="`ps -ax | grep 'ssh-agent -s' | grep -v grep | wc -l | tr -d '[:space:]'`"
   if [ "$RUNNING_AGENT" = "0" ]; then
        # Launch a new instance of the agent
        ssh-agent -s &> $HOME/.ssh/ssh-agent
   fi
   eval `cat $HOME/.ssh/ssh-agent`
fi
```

2. Forward via local SSH agent

You can add your local SSH keys to the agent if it is running by using the ssh-add command. For example, run this from a terminal or PowerShell:

```bash
# in local machine
ssh-add $HOME/.ssh/github_rsa
```

3. Now you can safely use git in DevContainer with local ssh credential.

## Close SSH keys sharing

Remove SSH credential forwarding by

```bash
# in local machine
ssh-add -D
```

Stop the ssh-agent in local machine.

```bash
# in local machine
eval "$(ssh-agent -k)"
```
