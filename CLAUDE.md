# GIMI Partner Portal — clickable prototype

A clickable prototype of a two-sided portal for GIMI's Certified Training Partner network.
**Partners** manage their students, invoices and leads. **GIMI staff** run an admin console
across all partners.

**This is a prototype, not working software.** Nothing persists, nothing is sent, there is no
authentication and there is no database. A refresh resets it. Its job is to settle what each
screen should do and to be shown to colleagues. It is not a foundation to build the real
product on.

**Read `docs/status.md` first.** This file says what the prototype should be;
`docs/status.md` says what it currently is, what is deliberately absent, and what is
waiting on a decision.

---

## Stack, and why it is this small

Plain HTML, CSS and JavaScript. No framework, no build step, no package manager, no server.

Five files, loaded in this order:

```
index.html        page shell and the prototype banner
styles.css        all styling; brand tokens live in :root
real-data.js      real partners and the real course taxonomy
data.js           builds the in-memory DB from real-data.js, plus invented delivery data
app.js            state, screens, actions, event wiring
```

Chosen because the owner is non-technical, drives development through Claude Code, and
deploys by pushing to GitHub. Anything with a build step or a dependency tree makes that
worse, not better. **Do not introduce a framework, a bundler, a CSS library or an npm
dependency.** "A nicer library exists" is not a reason.

`app.js` renders by rebuilding the current screen into `#root` and uses event delegation on
`data-action` attributes. Keep it that way; it is boring on purpose.

---

## Deployment

Public GitHub repository, served by GitHub Pages from `main` at the repository root, matching
how the owner's other sites are deployed:

```
https://aelharouchi01.github.io/<repo>/
```

`index.html` must stay at the repository root. Pushing to `main` republishes the site.

**This repository is public.** Nothing confidential goes in it, and that includes the git
history, which stays public even after a file is deleted. Specifically never commit:
personal names or email addresses, GIMI's internal assessment of any partner, royalty
percentages, per-person prices, or commercial terms.

---

## The data

`real-data.js` holds **real** GIMI data, generated from GIMI's own documents: **24 partner
companies** with the country each represents, region and partner type, and the **29
certifications** from the product catalogue with their descriptions, what is included,
skills, career outcomes, exam format and published prices. 25 of the 29 link to their live
course on `certifications.giminstitute.org`; four have no course yet and render as plain
text rather than a broken link.

Personal names and email addresses are replaced with generic `portal@` addresses, and
GIMI's internal activity assessment of each partner is removed. **Keep it that way**, and
never let the demo's shape depend on a field that gets stripped: it did once, and the live
site silently lost its queue and its partner directory.

`data.js` invents students, invoices, leads, votes and forum posts, because no real figures
for those exist. Invoice figures are coherent with the catalogue: partner revenue is
headcount times the certificate price, and the GIMI amount varies between rows rather than
being a fixed proportion, which is the point. Only the demo partner has revenue and
certification targets; the rest show "no target set" rather than an empty bar that reads as
failure.

A demo must never open empty. Land on populated data.

---

## What must be in it

Both sides, every section. This is the agreed surface.

**Sign in.** One form for both roles. No partner/admin picker: the role belongs to the
account. A top bar switches between the two views so the prototype can be demoed without
signing in and out.

**Admin console, seven tabs.** One tab per object, never per workflow. Pending work sits at the
top of the tab it belongs to.

| Tab | Contains |
|---|---|
| Overview | A needs-attention list of sentences with action buttons, then KPI groups for Network, Delivery and Finances, then certifications by type |
| Partners | `+ Add partner`, then invitations not yet accepted, then all partners with managed admin-only columns. A name opens that partner's own page |
| Students | Submissions to process, each opening its own page showing every person, then all students with filters and result dropdowns |
| Invoices | `+ New invoice` with the file attached at creation, then a needs-a-decision band, then all invoices, then revenue by partner |
| Leads | Waiting to be reviewed, then all leads. A name opens the lead's own page, where GIMI attaches documents for the partner |
| Recognition | The monthly cycle: nominations, the poll, past winners, closed polls, then the partner ranking |
| Settings | The Library documents partners can download, and the leaderboard switch |

**Partner portal.** Dashboard, Students, Invoices, Leads, Library, Community, and Leaderboard
only when the flag is on.

**There is no Profile tab.** A partner's own details, their directory choice and their logins
sit at the foot of the Dashboard. They are settings you change occasionally, not a place you
go to work, so they do not earn a tab.

**The onboarding chain, end to end.** Add a partner with a company name and an email. The
invitation email appears on screen instead of being sent, with a button to open the link as
the partner would. The partner sets a password and completes their organisation's details,
and that is what makes them active. **There is no approval step:** GIMI decided by choosing
who to invite, so approving afterwards was a rubber stamp and it was removed.

---

## Rules the prototype must keep demonstrating

These are the things worth arguing about before anything is built for real. Each one is
currently visible in the prototype and must stay that way.

**Money is never derived.** An invoice carries two independent figures a GIMI admin types
in: what the partner earns, and what GIMI bills them. There is no percentage anywhere in the
schema, the UI or this repository. No rate, no default share, no computed split. This was
built twice with a share percentage and rejected twice. GIMI's real commercial model does use
royalty percentages, and they live in the agreement, outside this system.

**Drafts are invisible to partners.** There is a draft invoice in the data. It must appear
nowhere on the partner side. Filter it where the data is selected, not in a component.

**Enrollment carries people, not counts.** A submission holds full student records. Never
store "5 students" without the five people. Every count on screen is derived from the roster
length so the two cannot disagree.

**A submission cannot be confirmed while a row is incomplete.** One seeded submission is
missing an email address on purpose. The partner fixes it, not GIMI.

**Internal notes are admin-only.** Custom partner columns, including GIMI's activity
assessment, appear only in the admin console.

**There is no approval step.** A partner is "Invitation sent" until they complete their own
details, then Active. Nothing for GIMI to click in between. Suspend and Reactivate are the
only status actions, and partners are never deleted so students and invoices cannot orphan.

**Feature flags gate whole sections.** The leaderboard is off by default, and when off the
partner has no nav item at all, not an empty page.

**One vote per account, and nobody votes for themselves.** A partner's own poll option is not
selectable.

**A poll option is wording GIMI writes, tagged to a partner.** Voters cannot judge a partner
they know nothing about, so an admin writes each option's text. Each option is also linked to
a real partner behind the scenes so the winner connects to a record.

**A nomination belongs to the month being recognised**, not the month it was collected.
July's award, decided in August, files under July.

---

## Brand

The design language comes from the **GIMI Store** (`gimi-landing.css` in that repo): the
same palette, Calibri, 8 and 14 pixel radii, uppercase teal eyebrows, cards with a coloured
top border, navy chrome with teal pills for the tabs.

**Note this is the live GIMI site palette, not page 15 of the printed manual.** The two
differ: the manual's teal is `#00858E`, the site's is `#2AACB5`. The store was aligned to
the site, so the portal follows the store. If the printed manual ever becomes the authority,
that is a deliberate decision to reverse.

```
teal        #2AACB5   primary: buttons, active tabs, links
teal-dark   #1E8A93   hover, headings on light
teal-light  #E6F6F7   badge and chip backgrounds
navy        #1B1F3B   header, nav, all headings
yellow      #C9D940   delivery accents
pink        #E15A78   attention, overdue, destructive
orange      #F0871E   finance accents
```

White page background, near-black body text. No dark mode. Colour belongs to chrome and
accents, never to body copy or table text. Every colour is defined once in `:root` in
`styles.css`; never write a hex code anywhere else.

**Every section is a card**: a titled header strip, then its contents, inside one border.
Use `section.block`. Use `block-plain` only when the contents are already cards, such as a
row of KPIs.

Logos: `gimi-logo.png` on white, `gimi-logo-white.png` on the dark teal header. Both are
cropped to the artwork; there is no vector version.

---

## Page order, on every screen

The same three bands, top to bottom, on both sides of the portal. This is not a
preference; it is how someone using the portal decides what to do.

1. **New.** Anything that creates something: `+ Add partner`, `+ New invoice`,
   `+ Enroll students`, `+ Add a lead`, a new poll. Always first, as a collapsed panel
   opened by a button.
2. **Pending, or waiting to be reviewed.** Anything asking for a decision: invitations
   not yet accepted, submissions to process, reported payments to confirm, drafts not
   sent, leads not reviewed, nominations to judge. Directly under the new band.
3. **Information.** Everything else: the full tables, history, rankings, reference
   lists, totals. Always last.

A screen with nothing pending simply has no middle band. A screen where nothing is
created has no first band. The order of what remains does not change.

## Interaction patterns

Four, and only four, so nobody has to work out what a thing is:

| Intent | Pattern |
|---|---|
| Drill into one record | A full page with a back link. Never a row that expands |
| Do something | A modal with a title bar, Cancel, and one primary button |
| Add something | A panel that opens inside its own section |
| Filter something | A toolbar in the section header, always top right |

## Conventions

- Every add action is a collapsed form inside the section it belongs to, opened by a
  button. Never its own tab.
- Every list shows a "showing X of Y" count.
- Any table wider than about eight columns scrolls horizontally rather than squashing.
- Empty states distinguish "nothing yet" from "nothing matches your filters".
- Switching view scrolls to the top.
- No prose paragraphs inside cards. Numbers and short labels; explanation goes underneath in
  small text or in a tooltip.
- Escape anything that came from data before putting it in the DOM. There is an `esc()`
  helper; use it.
- Status wording and money formatting live in one place each, not inline.

---

## Explicitly out of scope

Not missing, deliberately absent. Do not build these here:

real authentication, a database, persistence of any kind, sending email, QuickBooks, Moodle,
file uploads, an automated test suite, and a build pipeline.

The earlier attempt at the real application (Next.js, PostgreSQL via Prisma, NextAuth,
deployed to Vercel) exists in a separate private repository and is parked. If the decision is
made to build the real thing, that is where it resumes, not here.

---

## Working style

- Ask before restructuring navigation or renaming a domain concept.
- When a screen could be built two ways, say so and recommend one; do not silently pick.
- Prefer deleting a feature over building a confusing one.
- Push back when something is wrong rather than building it anyway.
- Say plainly what has been verified and what has not.
