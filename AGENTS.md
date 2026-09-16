# Repository Instructions

## Project context

- **Purpose:** A proof of concept for architects and mobile/backend engineers to
  validate Azure Monitor telemetry from an external client that behaves like an
  iOS application.
- **Architecture:** A portable client simulator emits operational telemetry to a
  controlled OpenTelemetry Collector and sends business events through an API
  gateway to a governed backend. Only the backend can call Azure Monitor Logs
  Ingestion. Operational and business telemetry use separate Azure paths.
- **Technology:** Node.js 22 or newer (through 25), TypeScript, Fastify,
  OpenTelemetry, Azure Monitor Ingestion SDK, Docker Compose, Bicep, APIM,
  Application Insights, and Log Analytics.
- **Commands:** `npm ci`, `npm run build`, `npm run lint`, `npm test`,
  `npm run test:coverage`, `npm run local:up`, `npm run local:down`, and
  `npm run infra:validate`.
- **Constraints:** Never put Azure credentials in the simulator. Keep event
  schemas closed, reject sensitive data, preserve W3C trace context, use an
  explicit runtime mode, and never silently fall back from Azure ingestion to
  local files. Shared APIM and Log Analytics resources must not be deleted.
- **Ownership:** Changes under `infra/`, `config/apim/`, telemetry sanitization,
  authentication, identity/RBAC, and event schemas require cloud security or
  platform review before production use.

## Source of truth

- GitHub issues define the problem, motivation, and ownership.
- `openspec/specs/` defines accepted product behavior.
- `openspec/changes/` contains proposed behavioral changes and implementation
  tasks.
- The codebase and automated tests demonstrate the current implementation.

If these sources disagree, stop and surface the conflict rather than silently
choosing one.

## Change workflow

1. Read this file, `openspec/config.yaml`, and relevant accepted specifications.
2. Inspect related GitHub issues and open pull requests before proposing work.
3. Use `/opsx-explore` for investigation that should not yet create artifacts.
4. Use `/opsx-propose` for substantive features, behavior changes, migrations,
   or architectural changes.
5. Review and approve the proposal and acceptance scenarios before applying it.
6. Use `/opsx-apply` and keep `tasks.md` accurate as work progresses.
7. Validate the exact acceptance scenarios and run the smallest relevant
   repository checks.
8. Open a pull request linking both the issue and OpenSpec change.
9. Archive the OpenSpec change only after the implementation is accepted.

Small documentation corrections, formatting-only edits, and clearly
non-behavioral maintenance may proceed without a new OpenSpec change.

## GitHub conventions

- Prefer an existing issue over creating a duplicate.
- Use one OpenSpec change for one cohesive outcome.
- When practical, name changes `<issue-number>-<short-description>`.
- Use `Closes #<issue>` only when the pull request fully resolves that issue.
- Never claim validation that was not run.
- Record intentional deviations from the approved proposal in the pull request.

## Engineering expectations

- Make focused changes and preserve unrelated behavior.
- Reuse established patterns before introducing abstractions or dependencies.
- Add or update tests for changed behavior and acceptance scenarios.
- Handle failures explicitly; do not hide errors behind success-shaped defaults.
- Keep credentials, tokens, personal data, and environment-specific values out
  of source control.
