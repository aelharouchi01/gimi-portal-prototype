# Where this is up to

Written 30 July 2026, at the end of a long build session. `CLAUDE.md` says what the
prototype **should** be; this file says what it **currently is**, what is deliberately
absent, and what is waiting on a decision. Read both.

---

## The two repositories

| | |
|---|---|
| **This one** | `gimi-portal-prototype`, public. The clickable prototype. **This is the active work.** |
| The other | `gimi-partner-portal`, private. A working Next.js + Postgres app whose Phase 0 is finished, now parked. Its `CLAUDE.md` opens with a PARKED banner. Do not resume it unless Ahmed says so. |

Live at **https://aelharouchi01.github.io/gimi-portal-prototype/**. Pushing to `main`
republishes it.

The private repo holds the prototype too, under `prototype/`, plus the two things this
repo cannot have: the unredacted data and the generator that produces it. **Edits are
made in the private repo and synced here** with `bash prototype/sync-to-public.sh`,
which swaps in the redacted data and refuses to run if a personal name, real email
address or GIMI's activity assessment would come with it.

Editing this repo directly is fine for a quick fix, but the two will then disagree.

---

## What is built

**Both sides, every screen, all working.**

### GIMI admin, seven tabs

| Tab | State |
|---|---|
| Overview | Attention list led by overdue money, 11 KPIs in three groups with last year beside each, all 29 certifications with LMS links, GIMI revenue by partner, CSV export, working year filter |
| Partners | Add and invite, invitations awaiting acceptance, search and filters, CSV, managed columns (add, rename, remove), a page per partner with comments and a year filter |
| Students | Submissions to process, each on its own page showing every person, reject with a reason, confirm to enrol, five filters, attributed result changes, CSV |
| Invoices | New invoice with the file attached at creation, needs-a-decision band, full lifecycle, a page per invoice with a comment thread, revenue by partner |
| Leads | Waiting to be reviewed, a page per lead where GIMI attaches documents the partner downloads, shared comment thread |
| Recognition | The monthly cycle numbered 1 to 4: nominations, poll built from them in one click, winners, closed polls, then the ranking |
| Settings | Library management with real file upload, and the leaderboard switch |

### The partner, six tabs plus one flag-gated

| Tab | State |
|---|---|
| Dashboard | Figures grouped by his own tabs, the open poll, progress against targets, nominate a partner, and his account details at the foot |
| Students | Enrol via a staging table with a completeness check, where each submission stands, his own students, CSV |
| Invoices | Awaiting your payment, "I have paid this", what he keeps, a page per invoice with the comment thread |
| Leads | Add a lead, what GIMI has attached, a page per lead |
| Library | The GIMI document set grouped, plus the 29-certification catalogue |
| Community | Directory of opted-in partners, and a forum |
| Leaderboard | Only exists when the flag is on |

**There is no Profile tab.** Account details sit at the foot of the dashboard.

---

## Rules that are enforced and verified

Each of these was tested by doing it, not by reading the code:

1. A partner sees 6 of 57 students. Tenant scoping holds.
2. A draft invoice exists and appears nowhere on the partner side.
3. A partner opening another partner's lead is bounced to their own list.
4. A submission with an incomplete row cannot be confirmed.
5. A draft cannot be sent without the invoice attached.
6. Rejecting a submission requires a reason, which the partner then sees.
7. One vote per account; a partner cannot select their own option.
8. With the leaderboard off, the partner has no nav item at all.
9. Removing a lead document or a Library document withdraws it from the partner.
10. There is no percentage anywhere. Both invoice figures are typed.

---

## Deliberately not built

Not missing. Absent on purpose, because this is a prototype:

real authentication, a database, persistence of any kind, sent email, QuickBooks,
Moodle, an automated test suite, a build pipeline.

The **Community** tab is the one screen that has had no design pass. It works but was
never reviewed.

---

## Waiting on a decision

1. **Four progress and vote-share bars survive**, on the partner leaderboard, the
   dashboard progress rows, and inside closed polls. Bars were removed from the
   Overview because they compared rows to the largest row. These compare against a
   target or a total, which is meaningful, so they were kept. Ahmed has not confirmed.
2. **Four certifications have no LMS course**: Certified Trainer In Future Foresight
   Levels 1 and 2, and Certified Management Consulting Levels 3 and 4.
3. **Course 475 is used twice**, for "Certified Innovation Leader" and "Certified
   Leader for the Future". One is probably wrong.
4. **"Certified GIMI Impact: Teachers" was given two courses**, 363 and 364. The
   first is used.
5. **Partner activity** (Active / Semi active / Passive / New) is carried as an
   admin-only managed column rather than a real field. Should it be a field?
6. **The seven real Library documents are not bundled**, being 118 MB together. Their
   download says so. Anything added through Settings downloads for real.

---

## Two habits worth keeping

**Play the role, do not read the code.** Walking the whole job as each user found a
page-breaking crash three clicks in, a partner id bug that collapsed 24 partners into
one, and a redaction that silently emptied the live site's approval queue. None of
those showed up in review.

**When a check fails, suspect the check first.** Several reported failures during QA
were the test, not the app: comparing lowercase text against headings that CSS
uppercases, reading the notice bar that quotes back the action just taken, and
hardcoding a count. Verify before fixing.

---

## Environment gotchas

- `gh` CLI is installed but has never authenticated. Do not rely on it. Plain
  `git push` works: Windows Credential Manager holds the credential.
- The Bash tool's working directory drifts back to `C:\Users\aelha`. Always `cd`.
- Browser screenshots fail in this setup. Verify with `read_page`, `get_page_text`
  and `javascript_tool`, and say that is what you did.
- The browser caches `app.js` and `data.js` hard. Restart the preview server to see
  changes, and do not trust a stale render.
