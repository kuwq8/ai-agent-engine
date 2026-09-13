# Titan AI Agent Engine

Titan is being rebuilt as a local-first coding engineer for large repositories.

## Architecture

- **Architect** — maps the task, dependencies, risks and implementation plan.
- **Librarian** — preserves project knowledge, decisions and lessons.
- **Builder** — proposes concrete, small and reversible code changes.
- **Reviewer** — challenges the plan for bugs, regressions and security problems.
- **Tester** — defines verification and evidence needed to accept a change.
- **Council** — passes each agent's result to the next agent so they reason as a team.
- **Workspace** — safely inspects the configured project directory and searches source files.
- **Local model** — uses Ollama through its local HTTP API; no cloud API key is required for this path.

## Server setup

Set the project directory and optional Ollama settings:

```env
TITAN_WORKSPACE=/absolute/path/to/the/project
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3-coder:30b
AI_TIMEOUT_MS=120000
```

Install a local model with Ollama, then start Titan normally:

```bash
ollama run qwen3-coder:30b
npm install
npm start
```

## Current scope

This branch deliberately keeps the existing Discord bot and legacy orchestrator intact while the new engine is built beside them. The new agents do **not** claim to edit or test files until real filesystem, terminal and Git tools are connected.

Next layers are project indexing, command execution sandbox, patch application, Git checkpoints, persistent project memory, iterative test/fix loops, and Discord progress reporting.
