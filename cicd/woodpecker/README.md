# Study Memo: Woodpecker CI

## 1. Overview

[Woodpecker CI](https://woodpecker-ci.org/) is a lightweight, self-hosted continuous integration (CI) tool that integrates with Gitlab. It uses a server-agent architecture to execute build tasks across different operating systems (macOS, Windows here).

## 2. Overall Architecture &amp; Workflow

### Architecture Diagram (Simplified)

```plain text
[ Developer Commits Code ]
          ↓
[ Gitlab Server ]  ←── Code + .woodpecker.yml (CI Configuration)
          ↓ Triggered by Webhook
[ Mac mini (Woodpecker Server) ]
          ↓ Task Scheduling
┌───────────────────────────────────┐
│  Mac mini (Also acts as Woodpecker Agent)
│  → Executes Tasks
└───────────────────────────────────┘
          ↓
[ Windows Agent (Standalone Machine) ]
      → Executes Tasks
```

### Workflow Explanation

1. Gitlab triggers a webhook when code is committed, PR is created, or a tag is pushed.

2. The webhook sends events to the Woodpecker Server (hosted on Mac mini).

3. Woodpecker Server parses the .woodpecker.yml configuration and assigns tasks to corresponding agents based on labels.

4. Agents (Mac mini + Windows) execute packaging tasks.

5. Agents push build artifacts to storage; Server writes build status back to Gitlab.

## 3. Key Architecture Components

1. **Mac mini (Core Machine)**
   - Runs Woodpecker Server via Docker (handles scheduling, UI, storage, trigger management).

   - Also runs a Woodpecker Agent simultaneously.

   - Automatically executes macOS packaging tasks when idle to maximize resource utilization.

2. **Windows Machine (Secondary Agent)**
   - Acts only as an execution node.

   - Communicates with the Server via labels and receives task assignments.

3. **Gitlab**
   - Stores code and CI configuration (.woodpecker.yml).

   - Receives build status feedback from Woodpecker CI.

   - Implements &#34;code as configuration&#34; (CI config is part of the codebase).

## 4. Pipeline Configuration Example (.woodpecker.yml)

Key features: Matrix (runs on multiple platforms), labels (task assignment), multi-stage pipeline (install → package → upload).

```yaml
matrix:
  platform: [macos, windows] # Runs pipeline on both platforms

labels:
  platform: ${platform} # Assigns tasks to agents with matching labels

pipeline:
  install:
    commands:
      - npm ci # Install dependencies

  package:
    commands:
      # macOS tasks (runs on Mac mini Agent)
      - npm run package:mac
      - codesign ... # Native macOS code signing
      - xcrun notarytool ... # Apple notarization

      # Windows tasks (runs on Windows Agent)
      - npm run package:win
      - SignTool sign ... # Windows code signing

  upload:
    commands:
      - cp dist/ /artifact-folder/ # Store build artifacts locally/shared directory
```

## 5. Deployment Steps

1. **Deploy Woodpecker Server (Mac mini)**
   - Deploy via Docker.

   - Configure Gitlab OAuth for authentication. Checkout [Forges - Gitlab](https://woodpecker-ci.org/docs/administration/configuration/forges/gitlab) for forges registration.

   - Start the service and set it to auto-start on boot.

2. **Deploy Woodpecker Agent (Mac mini)**
   - Deploy via Docker on the same Mac mini.

   - Configure label: `platform=macos`.

   - Automatically connects to the local Woodpecker Server; executes macOS tasks when idle.

3. **Deploy Woodpecker Agent (Windows Machine)**
   - Deploy via Docker.

   - Configure label:`platform=windows`.

   - Connect to the Woodpecker Server hosted on the Mac mini.

4. **Configure Gitlab Webhook**
   - Add the Woodpecker Server trigger URL to Gitlab.

   - Set triggers: code push, PR creation, tag push.

   - Enable automatic build status write-back to Gitlab.

## Key Takeaways

- Server-agent architecture enables cross-platform (macOS/Windows) task execution.

- .woodpecker.yml controls the pipeline; matrix and labels simplify multi-platform builds.

- Mac mini is the core (runs Server + Agent), Windows is a dedicated execution node.

- Tight integration with Gitlab (webhook trigger, status feedback, code-as-configuration).
