# Interface Gallery

Screenshots of the running system against the
`PROJECT_OPERATIONAL_SIMULATION_V8` population. The figures used in the
[main README](../../README.md) live in `readme/`; the two gallery folders are
the complete walkthrough.

| Folder | Contents |
| --- | --- |
| [`readme/`](readme/) | The 18 figures embedded in the main README, plus the system architecture diagram |
| [`admin-ui/`](admin-ui/) | 50 admin and manager screens, in workflow order |
| [`worker-pwa/`](worker-pwa/) | 13 worker PWA screens, in workflow order |

## Admin walkthrough (`admin-ui/`)

Numbered in the order an administrator would meet them: login and dashboard,
then master data, then the inbound → inventory → outbound flow, then the
planning and intelligence screens. Files sharing a number (`04-a`, `04-b`) are
steps within one screen or its variants; `02-dark-mode` and `02-sidebar` show
theme and navigation states of the dashboard.

## Worker walkthrough (`worker-pwa/`)

The installable worker app: login, task home, receiving, putaway, stock
transfer, route guidance and productivity. Files sharing a number (`08-1`,
`08-2`) are consecutive steps in one flow.

## Regenerating

These are captured manually against a seeded local stack. To reproduce the same
data, follow [SETUP.md](../../SETUP.md), which rebuilds every datastore from
tracked artifacts.
