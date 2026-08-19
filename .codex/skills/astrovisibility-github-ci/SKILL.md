---
name: astrovisibility-github-ci
description: Inspect and diagnose GitHub Actions for cosmicPickle/astrovisibility. Use when asked to check this repository's CI, Actions runs, workflow jobs, branch checks, or logs; use the dedicated GitHub CI fixing workflow when implementation is requested.
---

# Astrovisibility GitHub CI

Repository coordinates:

- Owner: `cosmicPickle`
- Repository: `astrovisibility`
- Default branch at bootstrap: `main`

Confirm the current remote and default branch from Git/GitHub before relying on
these bootstrap values; branch policy may evolve.

## Workflow

1. Inspect `git remote -v`, current branch, and `git rev-parse HEAD` when a commit
   exists.
2. Prefer the installed GitHub connector/plugin for run, job, check, PR, and log
   metadata.
3. For failing GitHub Actions that need a code/configuration fix, use the
   `github:gh-fix-ci` skill and follow it completely.
4. Match a run by head SHA and event, not only by branch name or "latest".
5. If the run is active, report its current state and link; do not diagnose
   incomplete logs as a final failure.
6. For failure, identify the exact workflow, job, step, and relevant log evidence
   before proposing or making changes.
7. Reproduce locally when practical, implement only an authorized fix, run the
   repository-required gates, and publish only when requested or an established
   repository workflow authorizes it.

If connector coverage is insufficient, `gh` or GitHub's REST API is an allowed
fallback. Never print or log authentication tokens. Request network/escalation
approval when the execution environment requires it.

Do not use PR-only helpers for a branch-push run without first confirming that a
pull request exists. Do not rerun, cancel, dispatch, approve, or mutate workflows
when the user asked only to inspect them.
