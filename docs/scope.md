# Screen by screen

What every screen shows, and what it must never show. Open the prototype alongside this.

Layout here is agreed. The code is not: this is a prototype, and its code is disposable.

---

## Sign in

One form, both roles. The role belongs to the account, so there is no picker. A prototype
banner across the top switches between the GIMI staff view and a partner view, so the whole
thing can be demoed without signing in and out.

---

## Admin console

Six tabs, one per object. Never one per workflow: an earlier version had *Partners, Students,
Invoices, Leads* alongside *Review Queue, Enrollments, CTP Requests*, so the same record lived
in two places. Pending work belongs at the top of the tab it belongs to.

### Overview

Two structurally separate things, in this order.

1. **Needs attention.** Sentences with an action button, only for work that is outstanding.
   Collapses to one positive line when there is nothing to do. This is a to-do list, not a
   scoreboard, and it must not look like one: pending work shown as big-number cards reads as
   a performance metric and was the wrong shape.
2. **KPI groups**, all computed:
   - **Network** — active partners, countries, leads submitted, lead pipeline value
   - **Delivery** — students enrolled, people certified, pass rate, awaiting enrollment
   - **Finances** — partner revenue, GIMI invoiced, GIMI received, outstanding

Then certifications by type with a share bar.

`outstanding` is `invoiced − received`, and invoiced excludes drafts. Pass rate guards
division by zero and shows a dash rather than 0%.

### Partners

Awaiting approval at the top, then all partners.

Columns: partner, status, country, region, partner type, logins, revenue target, then the
admin-only columns, then actions.

Row actions depend on state:

- **Approve** appears only when the partner is awaiting approval **and** somebody has
  completed the invitation. Approving an organisation with nobody able to sign in is
  meaningless.
- **Resend invite** appears while an invitation is outstanding. Resending invalidates the
  previous link.
- **Suspend** on an active partner, **Reactivate** on a suspended one. Partners are never
  deleted, so students and invoices cannot orphan.

`+ Add partner` is a collapsed form inside this section. It takes a company name and an email
address, and nothing else: the partner fills in the rest.

Clicking a partner name opens a **workspace** in place, containing their figures, the
admin-only notes, their invoices and their leads, and a scoped `+ New invoice`.

**Never shows:** nothing here reaches a partner. The admin-only columns, including GIMI's
activity assessment of each partner, exist only on this screen.

### Students

Submissions to process at the top. Each expands to **every person in the roster**, with
missing required fields marked. A submission with any incomplete row cannot be confirmed;
the partner fixes it.

Confirming creates the students and raises a draft invoice, in one step. The invoice's count
comes from the roster length.

Then all students, with a result dropdown per student. Results are set by hand: the LMS owns
the exam itself and the three-attempts rule.

### Invoices

Revenue by partner first, then every invoice including drafts, then a status legend.

Lifecycle:

```
DRAFT ──(admin uploads a PDF and confirms both figures)──▶ SENT
SENT ──(partner reports a bank payment)──▶ PAYMENT REPORTED
PAYMENT REPORTED ──(admin confirms funds)──▶ PAID
PAYMENT REPORTED ──(admin: not received)──▶ SENT, clearing the payment details
```

- A draft cannot leave draft without a PDF and a GIMI amount.
- Both figures are typed in separately and freeze once sent.
- A paid invoice is locked. Corrections mean a new invoice.
- Invoiced totals exclude drafts. Received counts paid only.

### Leads

Every lead across all partners, unreviewed first. Qualification fields: stage, probability,
met status, documents sent, expected revenue, expected close date. Expands to show the
products of interest and the support the partner asked for. Mark reviewed.

Leads are a snapshot of current state, not an activity log. There is no contact history and
no next-action date.

### Recognition

1. **Leaderboard switch.** When off, partners have no leaderboard nav item at all.
2. **CTP of the Month poll.** The admin writes each option's wording, because a voter cannot
   judge a partner they know nothing about. Each option is also tagged to a partner, invisibly
   to voters, so the winner links to a real record. Vote counts are hidden while the poll is
   open; the total is visible, the split is not. Closing publishes the result and records the
   winner against the month being recognised.
3. **Nominations queue** for the month, showing who nominated whom. A nomination may come from
   GIMI directly, and a partner may nominate themselves.
4. **Past winners.**
5. **Revenue ranking, admin only.** Never shown to partners in any form.

---

## Partner portal

| Screen | Shows | Never shows |
|---|---|---|
| **Dashboard** | Enrolled, certified, pass rate, certifications used. Progress against their own revenue and certification targets. The open CTP vote. Nominations they submitted. | Any other partner's figures |
| **Students** | `+ Enroll students` opening a staging table, submissions awaiting GIMI expandable to the roster, then their students with results | Other partners' students |
| **Invoices** | Sent, payment reported and paid only. Their revenue, the GIMI amount, a PDF download, `Report payment`. Bank details. | **Draft invoices, ever** |
| **Leads** | Their leads with the qualification fields, `+ Add a lead` | Other partners' leads |
| **Library** | The certification catalogue with links to each course and exam on the GIMI LMS, plus documents | — |
| **Community** | Directory of partners who opted in, and a forum | Partners who opted out |
| **Leaderboard** | Ranking by people certified, own row highlighted. **Absent entirely when the flag is off.** | Any money figure |
| **Profile** | Their own details, directory visibility switch, the logins on their account | Admin notes about them |

### The staging table matters

Rows parse in from the template, incomplete rows are flagged, and **sending is blocked until
every required field is present.** The partner fixes their own data. Required before GIMI will
accept a row: first name, last name, email, certification, exam date.

---

## Certifications

The taxonomy a student is enrolled against, from GIMI's own course sheet:

Innovation Potential Assessment (IPA) · Level 1 Associate · Level 2 Master · Level 3 Manager ·
Level 4 Audit · Future Foresight Levels 1 to 3 · Design Thinking Levels 1 and 2 · Certified
Innovation Professional (CIP) · Certified Chief Innovation Officer (CCIO) · Innovation
Catalyst · Leader of the Future · Innovation Primer · Longevity · Technovate

Ten of these have a course and exam entry on the LMS and are linked from the Library. The
remaining seven have no entry in the source sheet, so the Library says "Ask GIMI" rather than
guessing a link. If those courses exist, the sheet needs updating and the link will follow.

---

## Open questions

Things the prototype currently guesses at, which a real build would need answered.

1. **Partner activity.** GIMI tracks partners as Active, Semi active, Passive or New, which is
   not the same as the portal's awaiting-approval / active / suspended. It is carried here as
   an admin-only column. Should it be a real field?
2. **Revenue targets.** No real figures exist. Left empty rather than invented.
3. **Level 4 Audit, CIP, CCIO, Catalyst, IPA and Future Foresight 1 and 2** have no course
   entry in the source sheet.
4. **Leads as a queue.** Currently a snapshot. If GIMI wants to track follow-up, that is
   activity history and a next-action date, which do not exist yet.
