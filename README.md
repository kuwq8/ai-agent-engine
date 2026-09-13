# Titan AI Agent Engine

Titan is a local-first autonomous software engineering engine designed to work from Discord while the code workspace and Ollama model run on the server.

## Architecture

- **Architect** — understands architecture, dependencies, risks and the implementation plan.
- **Librarian** — maintains durable project decisions and lessons.
- **Builder** — produces structured file edits and verification commands.
- **Reviewer** — challenges the proposed implementation for correctness, security and regressions.
- **Tester** — defines verification and interprets failures as evidence.
- **Council** — passes evidence between agents so they reason as a team.
- **Workspace** — safely lists, reads and searches project files.
- **Executor** — runs a restricted set of project commands with timeouts and output limits.
- **Loop** — applies proposed changes, verifies them, rolls them back on failure, diagnoses the failure and retries.
- **Git** — records the current HEAD/status as a non-destructive checkpoint before an iteration.
- **Memory** — stores verified lessons for future tasks.
- **Local model** — uses Ollama; the core coding path does not require Gemini, Groq, Claude or OpenAI API keys.

## Server setup

Copy `.env.example` to `.env` and configure:

```env
DISCORD_BOT_TOKEN=
TITAN_WORKSPACE=/absolute/path/to/the/project
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3-coder:30b
AI_TIMEOUT_MS=120000
TITAN_COMMAND_TIMEOUT_MS=120000
TITAN_MAX_ITERATIONS=3
```

Then:

```bash
ollama run qwen3-coder:30b
npm install
npm run check:titan
npm start
```

## Discord commands

- `status` — Ollama, model, workspace and Git status.
- `search <term>` — source search.
- `analyze: <task>` — ask the full council to investigate without changing files.
- `fix: <task>` — autonomous analyze → propose → review → edit → test → diagnose → retry loop.

## Safety

Titan never accepts arbitrary shell syntax. Execution is limited to approved executable families, dangerous shell metacharacters are blocked, destructive Git mutations are blocked, and `.git`, `node_modules`, `.env*` and unsafe paths are protected from model writes.

## Verification

`npm run check:titan` syntax-checks every Titan JavaScript module and loads the engine. Full project tests are executed by Titan only when the Builder proposes an allowed verification command and the command completes successfully.

This branch is intentionally isolated from unrelated repositories. Do not deploy until the server has the required `.env` configuration and dependencies installed.
