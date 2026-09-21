# Catalogue responsiveness

Timestamp: 2026-09-21 23:27 +03:00 (Europe/Sofia)

The user reports All targets remaining at 0%. Fix cold-cache catalogue work
without changing visibility geometry, tolerances, ranking, or saved data.
The product specification and existing full-frame/window specifications control
the numerical behavior.

- Publish the equipment-filtered total before calculation; publish completed
  work at bounded time intervals, independently of the database batch size.
- Cooperatively yield within expensive target summaries, with cancellation
  checks before more work and before publishing completion.
- Profile and reduce repeated mask intersection work. A known point inside an
  intersection may prove its presence; absence still requires the complete
  spatial query. Never replace full-frame checks with centre-only checks.
- Preserve synchronous summary callers and exact interval results. No migration,
  new dependency, worker architecture, permissions, or network use.
- Regress progress before 256 targets and cancellation within a target; compare
  cooperative and synchronous summaries. Exercise mask holes, narrow obstacles,
  horizon and window inside/flush/outside cases with existing numerical suites.
- Keep existing CI/local performance limits. Measure full catalogue cold-cache
  work, then verify progress, cancellation and cached reopening on Android.
- Run format, typecheck, lint, affected tests, build; deliver a current release
  APK and inspect representative/constrained phone layouts.

The earlier real-observation cutoff discrepancy remains a separate open audit.
