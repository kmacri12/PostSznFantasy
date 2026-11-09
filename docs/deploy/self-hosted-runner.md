# Self-hosted CI runners

GitHub's included Actions minutes (2,000 a month) run out quickly with the 15-minute deploy catch-up, the nightly e2e stress run and a PR per issue. The workflows therefore pick their runner from repository variables, so the owner can move CI to the Ubuntu machine, or back, from a phone with no code change:

| Variable | Value | Used by |
| :--- | :--- | :--- |
| `CI_RUNS_ON` | `["self-hosted","postszn"]` | backend, frontend, audit, docker build, deploy |
| `CI_E2E_RUNS_ON` | `["self-hosted","postszn","e2e"]` | e2e and e2e stress (fixed ports 8100, 5273, 8101, 8102: one e2e job at a time, so only runner 1 carries the `e2e` label) |

Unset (or deleted), every job runs on `ubuntu-latest` as before. Switch from anywhere:

```bash
gh variable set CI_RUNS_ON --body '["self-hosted","postszn"]'      # use the home machine
gh variable delete CI_RUNS_ON                                       # back to GitHub-hosted
```

## What the workflows assume
- Postgres service containers publish a **random** host port (`job.services.postgres.ports['5432']`), because 5432 is taken by the local database. Never hard-code 5432 in a workflow.
- `playwright install` skips `--with-deps` when `CI_RUNS_ON` is set (no sudo on the runner); install the browser libraries once by hand.
- The repository is private, so a self-hosted runner never runs a stranger's pull request. Do not make the repository public without removing the runners.
- If the machine is off, jobs queue and deploys wait. Set `CI_RUNS_ON` back to fall back to GitHub-hosted runners.

## Owner setup (runs once, on the Ubuntu machine)
See `scripts/setup-self-hosted-runners.sh`: it downloads the runner, registers two (`ubuntu-home-1` with the `e2e` label, `ubuntu-home-2`) with a registration token from `gh`, and installs them as user systemd services. Keep disk space free: each job leaves a checkout, `node_modules` and a virtualenv under the runner's `_work` directory.
