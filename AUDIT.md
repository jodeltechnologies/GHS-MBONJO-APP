# GHS Mbonjo update audit

Scope: supplied source, uploaded CSV/PDF samples, public templates, permissions, assessment logic, export layout and build output. No access to the live Supabase or Vercel accounts. This is a code and document audit, not certification of live security or accessibility.

| Priority | Finding and correction | Exact source locations | Status |
| --- | --- | --- | --- |
| P0 | Department review and student subject access must be enforced on the server. Added subject-department validation and compulsory-plus-extra enrolment checks. | src/academics.js, src/access.js, api/school.js | Implemented and tested |
| P0 | Timed assessments must not trust the student's clock or reveal answer keys. Server deadlines, stored question snapshots, key redaction, one attempt per student/resource, late-answer rejection and objective scoring added. | src/exams.js, api/school.js, supabase/update-003.sql | Mocked API workflow and unit tests pass |
| P0 | Document request issuance and cancellation could race. Added database row locking and unique issued-document index. Teachers cannot issue official documents. | api/school.js, supabase/update-003.sql, supabase/schema.sql | Permission tests pass; SQL not executed against live Supabase |
| P0 | Private student data must not enter browser assets. Supplied CSV records live only in the server API data directory. Five blank matricules are flagged for manual completion instead of creating shared credentials. | api/data/students.json, api/school.js, src/app.js | 87 unique assigned matricules verified |
| P1 | Principal marks were difficult to find and historical-year filters were missing. Added dashboard shortcut and server query for year/class, including drafts. | src/app.js, api/school.js | Template and access tests pass |
| P1 | Compulsory subjects, optional extras and class management were absent. Added explicit class configuration and individual extras. | src/academics.js, src/app.js, src/domain.js | Tested |
| P1 | Student movement controls were difficult to find. Added transfer, promotion, demotion, dismissal and reinstatement with reasons and preserved history. | src/app.js, api/school.js | Implemented; live acceptance check required |
| P1 | Learning resources only accepted typed text. Added PDF upload, size/type/signature checks and download. | src/app.js, api/school.js | Invalid upload rejection tested; PDFs are not malware-scanned |
| P1 | Report layout lacked columns and school remarks areas. Added subject average, grade, rank, final mark, coefficients, totals, photo and observations. Master sheet has vertical subject headers and print layout. Missing marks stay excluded. | src/app.js, public/style.css, api/school.js | 21-subject template render checked; browser pagination unverified |
| P1 | Navigation disappeared when scrolling. Added sticky header, mobile navigation dock, dashboard selector and breadcrumbs. | src/app.js, public/style.css | Source/render checks complete; real-device QA pending |
| P1 | Main JavaScript bundled export/spreadsheet tools into the first load. Split these into on-demand chunks. Main app is about 174 KB instead of 2.3 MB, before compression. | build.mjs, public/app.js, public/chunks/, public/sw-template.js | Build verified; live loading speed not measured |
| P1 | Fonts depended on installed computer fonts. Bundled Outfit and Tinos, embedded document export fonts, preserved licence files. | public/fonts/, public/style.css, src/exports.js | One-page PDF and Word attestation rendered and visually reviewed |
| P2 | Uneven spacing and generic page hierarchy. Applied consistent emerald/gold styling, rounded campus composition, revised cards, stronger typography and restrained motion. | public/style.css, src/app.js | Implemented; visual browser review pending |
| P2 | Dialogs lacked an explicit accessible name. Added aria-labelledby; preserved native dialog, labelled form controls, visible focus, skip link, live status and reduced-motion support. | src/app.js, public/style.css, public/index.html | Source checked; screen-reader and 200% zoom testing pending |
| P2 | Public route metadata was generic and private routes should not be indexed. Added route-specific title/description updates and X-Robots-Tag on portal/login/verification. | src/app.js, vercel.json | Implemented; search indexing not verified |
| P2 | AI setup exposed a model-ID field. Removed it and added provider discovery with seven allowlisted providers. | src/providers.js, src/app.js, api/school.js | Source checked; real provider keys/quotas untested |

## Validation performed

37 automated tests cover origin/session checks, roles, department approval, compulsory subjects, parent isolation, deadlines, scoring, duplicate import prevention, document requests, backup encryption, report arithmetic, timetable conflicts and prior features. Three tests exercise the API handler with a mocked database, including HOD approval followed by student submission and principal issuance of a teacher request.

109 public-page, role-panel and editor template render checks passed in an isolated JavaScript harness. These are not browser clicks or visual viewport tests. Generated a 21-subject report template. Rendered and reviewed one-page attestation PDF and Word exports with the bundled font.

Production build succeeds. Export and spreadsheet libraries load on demand. Public assets are separated from api/data student records. Service worker excludes private API POST responses.

## Remaining checks and limits

- Check the timetable preferences on the live deployment: set one teacher's unavailable day and confirm their sheet is empty on it, and confirm an impossible limit is refused with a message rather than saving a partial timetable.
- Check the generated timetable on the live deployment before printing for the school: one class sheet, one teacher sheet, and that no teacher appears in two classes in the same period. Generation is deterministic, so a regenerated timetable should match.
- Apply update-003.sql and check live authentication, role assignments, database constraints, real multi-user concurrency and backups. Student access now requires the matricule and the student's own date of birth. Confirm on the live deployment that a correct pair signs in, a wrong date does not, and a record with a blank date of birth shows the administration message.
- Browser preview was blocked/unavailable for this static project. Mobile widths, actual buttons/forms, print pagination, keyboard focus order, colour contrast ratios, screen-reader behaviour, PWA installation, JavaScript console and real performance need live browser checks. No claim of WCAG conformance or full end-to-end certification is made.
- Test the principal, HOD, teacher, parent and student accounts with non-production records before rollout.
- Tests do not use actual AI keys. Free credits and model availability vary. A provider may reject a discovered model due to account or quota limits.
- An expired assessment rejects late answers. If a student closes the page before submission, reopening triggers deadline submission using saved answers. No background scheduler runs while the student is away.
- Document PDF is text-based but not tagged for PDF accessibility. Long custom letters flow onto additional pages; a repeated letterhead on continuation pages is not implemented.
- Reports currently generate one selected sequence or promotion examination. Annual/term aggregation, paper-pass totals and automatic promotion require confirmed school rules. Do not infer those rules from the scanned examples. Report remarks/signature fields remain spaces for manual completion.
- The .xls upload is a missing-sheet HTML wrapper. Scores and exact Sixth Form combinations cannot be imported from it. Five missing matricules and 63 missing birthplaces need school confirmation.
- Subject catalogue and editable stream suggestions support Arts/Science and cross-stream subjects. They do not claim every suggested subject is nationally compulsory or offered in every Sixth Form combination.
- Public content still depends on JavaScript for rendering. Full server-rendered SEO, rich social previews and crawler results have not been implemented or verified.

## Reference checks

The school samples control the document/report structure. Public subject reference: https://camgceb.org/examinations/gce-advanced-level/ and https://camgceb.org/examinations/ . Stream suggestions are implementation choices for school review.

Provider documentation checked: https://ai.google.dev/api/models , https://inference-docs.cerebras.ai/api-reference/models/list-models , https://docs.sambanova.ai/docs/en/models/rate-limits , https://huggingface.co/docs/inference-providers/en/pricing . These sources do not guarantee unlimited free access.

Design reference supplied by the user: https://jodeltech.vercel.app/ . Its retrieved markup/styles informed typography, spacing, sticky navigation and restrained motion. School imagery and content were retained.
