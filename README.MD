# Universal Coder

**Status:** Archived. This project is preserved in its original form as a historical artifact.

## Overview
Universal Coder is an early prototype of an agentic development assistant built on **ChatGPT (GPT‑3.5)**. The idea of “agentic” tooling appeared **around 2023** (three years before this archive), and this repository captures one of the first working versions.

Project layout:
- `services/core` — NestJS backend with a “model → tool → model” loop.
- `services/client` — a minimal React client that subscribes to events.
- `services/docker-compose.yaml` — runs the two containers.

## How It Worked
The service sends a prompt to the model and then processes the response. If the model returns a tool command, the backend executes it in the shell and sends the result back to the model, repeating until a final response is produced.

Key files:
- `services/core/src/chat/consts.ts` — system prompt describing the tools.
- `services/core/src/chat/chat.service.ts` — the model interaction loop.
- `services/core/src/util/terminal.ts` — command execution and stdout/stderr capture.
- `services/core/src/chat/controller/chat.controller.ts` — HTTP API and control flow.
- `services/client/src/*` — minimal UI for displaying messages.

**Key tools (from the system prompt):**
- `EXECUTE [command] $END` — execute a terminal command.
- `READOUT limit=... skip=...` — read stdout.
- `READERR limit=... skip=...` — read stderr.
- `CRON [seconds] $END` — wait and check status.
- `SIGINT $END` — interrupt execution.
- `ASK [question]` — ask a human.

## Example Commands
Example user request:

```text
List the files in the project and tell me what you see.
```

Possible agent response (tool command):

```text
EXECUTE ls -la $END
```

Reading output:

```text
READOUT limit=500 skip=0
```

## Architecture (Simplified)
1. The client sends a message to `POST /chat/query`.
2. `ChatService` sends the request to the model.
3. If the model returns a tool command, the backend executes it (`Terminal.exec`).
4. The result is sent back to the model.
5. Once the response is plain text, it is returned to the client.

## Quick Start (As It Was Back Then)

```bash
cd services
make up
```

Defaults:
- client — `http://localhost:3000`
- backend — `http://localhost:3005`

## Note
This repository is **archived**. The code is no longer maintained and may require updates for modern SDKs and environments.

---

If you found this repository: it is not a “product,” but a preserved snapshot of an early agentic development idea.
