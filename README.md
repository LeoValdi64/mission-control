<div align="center">

# 🚀 Mission Control — LeoValdi Fork

**AI agent orchestration dashboard — customized and extended.**

Built on top of [builderz-labs/mission-control](https://github.com/builderz-labs/mission-control) with custom modifications and model updates.

[![Fork of Mission Control](https://img.shields.io/badge/Fork_of-Mission_Control-orange?logo=github)](https://github.com/builderz-labs/mission-control)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## What is this?

A customized fork of **Mission Control** — the open-source dashboard for AI agent orchestration. Used for managing AI agent fleets, tracking sessions, monitoring costs, and coordinating multi-agent workflows.

### Fork-specific changes

- **Anthropic model catalog** — Updated to latest models (Opus 4-6, Sonnet 4-6, Haiku 3.5) with 1M context support
- **Custom gateway tuning** — Configured for multi-agent setups with OpenClaw
- Regularly synced with upstream for new features and fixes

## Quick Start

```bash
git clone https://github.com/LeoValdi64/mission-control.git
cd mission-control
pnpm install
cp .env.example .env    # configure your values
pnpm dev                # http://localhost:3000
```

> Requires [pnpm](https://pnpm.io/installation). Install with `npm install -g pnpm` or `corepack enable`.

## Key Features

- **28 panels** — Tasks, agents, logs, tokens, memory, cron, alerts, webhooks, pipelines, and more
- **Real-time monitoring** — WebSocket + SSE push, smart polling
- **Zero external deps** — SQLite, single `pnpm start`, no Redis/Postgres/Docker
- **Role-based access** — Viewer, operator, admin roles
- **Direct CLI integration** — Connect Claude Code, Codex, or any CLI tool directly
- **Multi-gateway** — Connect to multiple agent gateways simultaneously
- **Agent SOUL system** — Define agent personality and capabilities via markdown
- **Pipeline orchestration** — Workflow templates for multi-step operations

## Syncing with Upstream

```bash
git fetch upstream
git merge upstream/main
git push origin main
```

## Full Documentation

For architecture, API reference, environment variables, deployment, and contributing guidelines, see the [upstream README](https://github.com/builderz-labs/mission-control#readme).

## License

[MIT](LICENSE) — Original project © 2026 [Builderz Labs](https://github.com/builderz-labs).
