# GIMI Partner Portal — prototype

A clickable prototype of a two-sided portal for GIMI's Certified Training Partner network.
Partners manage their students, invoices and leads; GIMI staff run an admin console across all
partners.

**It is a prototype, not working software.** No server, no database, no authentication, and
nothing is ever sent. State lives in the browser's memory, so a refresh resets it.

## Running it

Double-click `index.html`. There is no build step and no internet connection required.

For a local address instead:

```
python -m http.server 8200
```

then open `http://localhost:8200`.

## Deploying

Push to `main`. GitHub Pages serves the repository root, so the site updates on its own.

`index.html` must stay at the repository root for that to work.

## What to click

The banner across the top switches between the GIMI staff view and a partner view at any time.

**Onboarding a partner, the full chain.** Partners tab → `+ Add partner` → enter a company
name and any email address. The invitation email appears on screen rather than being sent, with
a button to open the link as the partner would. Complete the setup form, then return to the
staff view and approve. Note that **Approve does not appear until somebody has accepted**, and
that accepting an invitation is not the same as being approved.

**Enrollment.** As a partner: Students → `+ Enroll students` → `Upload the GIMI template`.
Three rows appear and one is deliberately missing an email, so sending is blocked until it is
fixed. As staff: Students → expand a submission to see every person → Confirm. That creates the
students and raises a draft invoice in one step.

**Invoices.** A draft cannot be sent without a PDF and a GIMI amount. Once sent, the partner
can report a payment; staff can confirm it or mark it not received, which clears the payment
details and returns it to sent. A paid invoice is locked.

**Recognition.** Turn the leaderboard on and off and watch the partner's nav item appear and
disappear entirely. Build a CTP of the Month poll: you write each option's wording and tag it
to a partner behind the scenes. Partners vote from their dashboard, one vote per account, and
cannot select their own entry. Closing the poll records the winner against the month being
recognised.

## The data

Partners and the certification taxonomy are real, taken from GIMI's own workbooks: 32 partner
companies with country, region and partner type, and 17 certifications linked to their courses
and exams on the GIMI LMS.

Personal names and email addresses are **not** in this repository. They were replaced with
generic `portal@` addresses, and GIMI's internal assessment of each partner was removed,
because this repository is public and its history is public with it. The full dataset and the
script that generates both variants live in a separate private repository.

Students, invoices, leads, votes and forum posts are invented, because no real figures for
those exist. Revenue targets are left empty rather than made up.

## Files

```
index.html      page shell and the prototype banner
styles.css      all styling; brand colours defined once in :root
real-data.js    real partners and the real course taxonomy
data.js         builds the in-memory data from real-data.js, plus invented delivery data
app.js          state, screens, actions, event wiring
docs/scope.md   every screen, what it shows and what it must never show
CLAUDE.md       project instructions, read automatically by Claude Code
```

Plain HTML, CSS and JavaScript on purpose. No framework, no bundler, no dependencies, nothing
to install.
