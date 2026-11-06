# Lodestar: college counselling for the Common App

A complete, single-machine counselling workspace for US applications. Python 3 standard library only (`http.server` + `sqlite3`), static vanilla-JS frontend, no build step, no Node.

## Run

```bash
cd collegeapp
python3 server.py          # http://127.0.0.1:8200   (or: python3 server.py 9000)
```

The SQLite database is created and seeded on first start at `data/college.db`. Delete that file to reset the demo data.

Demo accounts (password for all: `demo1234`):

| Role | Email |
|---|---|
| Counsellor | `counsellor@demo.edu` (Dr. Maya Okafor) |
| Editor | `editor@demo.edu` (Daniel Reyes) |
| Student | `priya@demo.edu` (Priya Raman, strong STEM profile, nearly complete) |
| Student | `marcus@demo.edu` (Marcus Bell, humanities / rower, gaps to fix) |

## What's in it

- **Home**: readiness ring, next deadline countdown, task and SAT summaries, per-section Common App progress, essay status, activity feed.
- **Common App profile** (autosaving, schema-driven): Profile, Family, Education, Testing, **Activities (10 slots; position 50 / organization 100 / description 150 characters)**, **Honors (5 slots; title 100 characters)**, Writing (links to the personal essay, 250-650 words, all 7 prompts), **Additional information (650 words)**, Courses & Grades (with GPA estimate). Limits are enforced in the UI and again on the server. Activities and honors can be reordered.
- **Essay workspace**: write mode for the student; review mode with text-anchored comments and threaded replies, suggested edits (editor/counsellor propose, student accepts or rejects), resolve/reopen, manual and automatic version history with word-level diff and restore, live word count against the limit, 5-second polling so collaborators see each other's feedback, download as text. Supplemental essays are tracked per college.
- **College list builder**: searchable catalog of 42 Common App colleges (approximate admit rates, SAT ranges, typical 2026-27 deadlines). Auto reach / target / safety from the student's best SAT and the school's admit rate, with manual override, a balance check, round (ED/EA/REA/RD/Rolling), status, notes. Adding a college creates its submission task.
- **Tasks & deadlines**: grouped Overdue / This week / Later, category filters, college links, deadline strip.
- **Recommendations**: letter tracker with pipeline status, due dates, schools and notes.
- **SAT prep**: overview, 4/8/12-week study plans with weekly checklists, timed practice sets (original questions, graded server-side with explanations), score tracker with trend chart and target line, test-date and deadline calendar, curated resource links.
- **Messages**: team thread (student + staff) and a staff-only thread, unread badges.
- **Caseload** (staff): readiness, list balance, essays, tasks, recs, SAT, next deadline and attention flags for every assigned student; sortable and filterable; counsellors can add students.
- **Accounts and security**: PBKDF2-SHA256 (200k iterations, per-user salt), random session tokens (14 days), login throttling, role-based access on every endpoint (students see only themselves; staff only their assigned students), parameterized SQL, output escaping in the UI, CSP and other security headers.

### Roles

| | Student | Editor | Counsellor |
|---|---|---|---|
| Edit profile sections | yes | no (read) | yes |
| Edit essay text | **yes (only)** | no | no |
| Comment on essays | yes | yes | yes |
| Suggest edits | no | yes | yes |
| Accept / reject suggestions | **yes (only)** | no | no |
| College list, recs, SAT scores | yes | read | yes |
| Tasks | yes | yes | yes |
| Staff-only messages, caseload | no | yes | yes |
| Add students | no | no | yes |

## Design rationale

**Information architecture.** The Common App's own mental model is the spine: a **Profile** area with its real sections in its real order (students already know it), separate from **My Colleges**. Around that I put what counsellors actually juggle: essays, recommendations, tasks, SAT. A persistent left sidebar (as in Linear, Notion and Asana) keeps every area one click away; counsellors and editors get a **student switcher** plus a top-level **Caseload** so they move between a portfolio view and one student's workspace without losing context. Profile sections use a stepper with completion dots, the same pattern as the Common App and TurboTax-style guided forms, so students see what is left.

**Collaboration model.** Modeled on Google Docs' suggesting mode, simplified for students: only the student changes the text, editors propose changes and comments, and the student accepts. That keeps authorship honest, which matters in admissions, while still giving editors a precise tool. Every accepted edit and restore snapshots the earlier text, so nothing is lost.

**Visual theme.** Warm paper neutrals with a single ink-blue accent (trust, calm, not alarm-red like many deadline tools), semantic colors reserved for status (reach red, target blue, safety green; overdue red). Essays are set in a serif at reading size (the product's most emotional content deserves a page, not a form field); everything else is system sans for speed and clarity. Light and dark themes, keyboard focus rings, aria labels, reduced-motion support and a responsive layout (the sidebar collapses on phones).

**Principles taken from well-regarded tools.** Progress visible at a glance, one primary action per screen, empty states that tell you what to do next, autosave instead of Save buttons, plain-language flags for counsellors ("No safety school on list") rather than raw numbers.

## Honest limitations

- **"Analyze your entire database and history":** I have no access to any database or history of yours, so nothing here is derived from your data. The design is based on my general knowledge of counselling and productivity tools and of the Common App.
- Catalog figures (admit rates, SAT mid-50% ranges) and 2026-27 deadlines and SAT dates are **approximate** and should be verified against each school and collegeboard.org. This app does not submit anything to the Common App; it is a planning and collaboration layer. Common App field wording and limits reflect my knowledge as of writing and can change between cycles.
- SAT practice questions are a small set of original warm-ups (12), not a question bank. Use Bluebook for real practice.
- No email notifications; collaboration uses polling. The server is built for a single machine or small team (stdlib `ThreadingHTTPServer`, SQLite). For public deployment, put it behind HTTPS and a real reverse proxy and change the demo passwords.

## Layout

```
collegeapp/
  server.py     HTTP server, auth, all API routes
  db.py         schema, progress metrics, college catalog
  seed.py       demo users and data
  satdata.py    study plans, resources, test dates, practice questions
  static/       index.html, style.css, js/ (core, home, profile, essays, planning, sat, messages)
```
