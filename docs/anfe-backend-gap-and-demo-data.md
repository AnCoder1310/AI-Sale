# An frontend audit against `develop` (2026-10-10)

Update 2026-10-11: Manager assignments and advisor performance are implemented on `feature/manager-assignments-performance` for PR to `develop`. The table below records the original gap assessment; the current implementation links assignments to specific practice sessions and ranks only advisors with at least three manager-approved, scored sessions.

Compared `origin/anfe` (51add6c) with `origin/develop` (d206724) before integration. The branch contains both frontend screens and divergent backend work. The integration retains the current `develop` backend contracts; additional features below need their own reviewed vertical slices.

| Priority | Feature in An's branch | Backend status on `develop` | Decision |
| --- | --- | --- | --- |
| 1 | Manager assignment of scenarios to advisors | No assignment persistence or API on `develop`. An's branch has an initial implementation, but it diverges from newer practice records and was not merged. | Build and test after core review flow; include advisor assignment inbox and completion tracking. |
| 2 | Advisor list, competency trends, rankings | `GET /manager/overview` and `/manager/attempts` provide totals and attempts, but no detailed advisor or trend API. | Useful; derive aggregates from actual completed and approved attempts. Do not invent scores for users with no attempts. |
| 3 | Manager report and history views | `GET /manager/attempts` exists; An's UI called `/manager/history`. | Use the existing endpoint now. Add filters/pagination or export only when the demo needs them. |
| 4 | Knowledge catalog, vehicle details, prices, policies, FAQ, PDFs | Copilot can retrieve source documents; there is no backend catalog/version management. An adds local content and PDF files. | Keep only source-verified, dated material for the demo. Add a managed catalog if editing, expiry, or document status becomes a requirement. |
| 5 | Charging station finder and network metrics | No maintained station source or live availability API. An's values are static. | Defer; do not present network counts, uptime, or station availability as live facts. |
| 6 | System administration, provider health, re-index, MRR dashboard | No matching administration or metrics API. | Exclude from the demo until instrumented. This is outside the MVP sales coaching flow. |

## Real demo data to create

1. Seed a manager and at least two advisor accounts using the existing seed path or a reviewed extension. Use invented identities and private demo credentials.
2. Complete several actual Practice Room sessions for each advisor, including one strong and one weak interaction. Persist their transcript, AI evaluation, evidence quotes, and timestamps through the product API.
3. Have the manager review and approve some sessions, leaving at least one pending. The dashboard and history should then show real counts and scores.
4. Once assignments are implemented, create one assignment for an advisor and complete it through the product flow. Do not fabricate assignment cards before this exists.
5. Curate a small set of current vehicle, price, charging, and policy documents. Record source URL, publication/effective date, version, and status. Verify that every visible claim and downloadable PDF corresponds to the source document and that Copilot citations resolve.
6. Run the demo on a shared, persistent database if multiple devices/users participate; local SQLite/PostgreSQL instances do not share records automatically.

The integration removes fabricated manager profiles, attempt rows, review fallbacks, and unsupported operations from the visible manager flow. It also hides the static charging dashboard pending a verified data source.
