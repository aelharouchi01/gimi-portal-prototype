/* ===========================================================================
   GIMI Partner Portal — clickable prototype
   No server, no database, no network. State lives in memory and a refresh
   resets it. That is what makes this a prototype and not the product.

   It mirrors the real rules so the behaviour is worth arguing about:
     - drafts are filtered out of every partner view
     - a submission carries people; counts are derived from roster length
     - invoices hold two independent figures and no percentage
     - the leaderboard is off by default and then has no partner nav item
     - accepting an invitation is not approval
   =========================================================================== */

const S = {
  screen: "signin",        // signin | onboarding | done | admin | partner
  identity: null,
  adminTab: "overview",
  partnerTab: "dashboard",
  year: "2026",
  open: {},                // expanded rows, keyed by id
  notice: null,            // { kind: 'ok'|'bad'|'info', text }
  modal: null,             // { title, body, foot }
  onboardingPartnerId: null,
  staging: [],             // rows on the partner Enroll screen
  pollDraft: null,

  // Partners tab filters.
  partnerSearch: "",
  partnerStatus: "ALL",
  partnerRegion: "ALL",

  // Id of the partner whose own page is open, or null for the list.
  partnerPage: null,
  // Id of the lead whose own page is open, or null for the list.
  leadPage: null,
  // Id of the submission whose own page is open, or null for the list.
  submissionPage: null,

  // The month Recognition is working on. An award is decided the month after the
  // one it recognises, so this names the month being recognised, not today.
  awardMonth: "2026-07",

  // Students tab filters.
  studentSearch: "",
  studentPartner: "ALL",
  studentCert: "ALL",
  studentStatus: "ALL",
  studentYear: "ALL",

  // Element to refocus after a re-render, so typing in a search box survives it.
  focus: null,
};

/* ----------------------------------------------------------------- helpers */

const $ = (sel) => document.querySelector(sel);

/**
 * Real files attached to invoices, keyed by invoice id.
 *
 * Held in memory, not in DB, because a File is not data to be copied around: the
 * partner downloads this exact object. It does not survive a refresh, which is true
 * of everything in this prototype. Seeded invoices have a filename and no file
 * behind it, and the download says so rather than pretending.
 */
const ATTACHMENTS = new Map();

/**
 * Real files attached to leads, keyed by document id. Same reasoning as ATTACHMENTS:
 * GIMI attaches a document, and the partner who owns that lead downloads the exact
 * file to take into a client conversation.
 */
const LEAD_FILES = new Map();

const money = (cents) =>
  cents === null || cents === undefined
    ? "—"
    : "$" + Math.round(cents / 100).toLocaleString("en-US");

const date = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
};

const monthName = (ym) => {
  const [y, m] = ym.split("-");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${months[Number(m) - 1]} ${y}`;
};

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );

const partner = (id) => DB.partners.find((p) => p.id === id);
const partnerName = (id) => partner(id)?.name ?? "Unknown partner";

/**
 * There is no approval step. Sending the invitation is the decision, so a partner is
 * INVITED until they complete their own details and then simply ACTIVE.
 */
const PARTNER_STATUS = {
  INVITED: ["Invitation sent", "badge-pending"],
  ACTIVE: ["Active", "badge-active"],
  SUSPENDED: ["Suspended", "badge-suspended"],
};

const INVOICE_STATUS = {
  DRAFT: ["Draft", "badge-draft"],
  SENT: ["Sent", "badge-sent"],
  PAYMENT_REPORTED: ["Payment reported", "badge-reported"],
  PAID: ["Paid", "badge-paid"],
};

const STUDENT_STATUS = {
  ENROLLED: "Enrolled",
  IN_PROGRESS: "In progress",
  PASSED: "Passed",
  FAILED: "Failed",
};

const SUBMISSION_STATUS = { PENDING: "Awaiting GIMI", PROCESSED: "Enrolled", REJECTED: "Rejected" };
const LEAD_STAGE = { NEW: "New", QUALIFIED: "Qualified", IN_DISCUSSION: "In discussion", CLOSED: "Closed" };
const MET_STATUS = { NOT_YET: "Not yet met", INTRO_CALL: "Intro call", MET_IN_PERSON: "Met in person" };
const DOCS_SENT = { NOTHING: "Nothing", OVERVIEW: "Overview", PROPOSAL: "Proposal", PRICING: "Pricing" };

/** A certification's catalogue entry, by name. */
const catalogueEntry = (name) => DB.catalogue.find((c) => c.name === name);

const badge = (label, cls) => `<span class="badge ${cls}">${esc(label)}</span>`;
const partnerBadge = (st) => badge(...PARTNER_STATUS[st]);
const invoiceBadge = (st) => badge(...INVOICE_STATUS[st]);

/* Required before GIMI will accept a roster row. Mirrors the real rule. */
const rowIncomplete = (r) =>
  !r.first?.trim() || !r.last?.trim() || !r.email?.trim() || !r.cert || !r.examDate;

const submissionBlocked = (sub) => sub.roster.some(rowIncomplete);

/* ------------------------------------------------------------ year filter
   Years present in the data, newest first, so the control never offers a year
   with nothing in it. */
const YEARS = [
  ...new Set([
    ...DB.students.map((s) => s.examDate?.slice(0, 4)),
    ...DB.invoices.map((i) => i.issuedAt?.slice(0, 4)),
    ...DB.leads.map((l) => l.submittedAt?.slice(0, 4)),
  ].filter(Boolean)),
].sort().reverse();

/* Months Recognition can work on: any month already carrying a nomination or a
   winner, plus the two most recent, newest first. Derived so the selector never
   offers a month with nothing in it and never goes stale. */
const AWARD_MONTHS = [
  ...new Set([
    "2026-07", "2026-06",
    ...DB.nominations.map((n) => n.month),
    ...DB.winners.map((w) => w.month),
  ]),
].sort().reverse();

/* The prototype's "today". Fixed rather than the real date, so the seeded data keeps
   telling the same story: two invoices are overdue and stay overdue. */
const TODAY = "2026-07-30";

const inYearOf = (iso, year) => typeof iso === "string" && iso.startsWith(year);

const studentsIn = (year) => DB.students.filter((s) => inYearOf(s.examDate, year));
const invoicesIn = (year) =>
  DB.invoices.filter((i) => i.status !== "DRAFT" && inYearOf(i.issuedAt, year));
const leadsIn = (year) => DB.leads.filter((l) => inYearOf(l.submittedAt, year));

const studentsInYear = () => studentsIn(S.year);
const invoicesInYear = () => invoicesIn(S.year);
const leadsInYear = () => leadsIn(S.year);

/** The year before the one selected, or null when there is no data for it. */
const previousYear = () => {
  const before = String(Number(S.year) - 1);
  return YEARS.includes(before) ? before : null;
};

/* Derived figures. Computed, never stored. */
const nonDraft = () => DB.invoices.filter((i) => i.status !== "DRAFT");
const invoicedTotal = () => nonDraft().reduce((n, i) => n + i.gimiAmount, 0);
const receivedTotal = () => DB.invoices.filter((i) => i.status === "PAID").reduce((n, i) => n + i.gimiAmount, 0);
const partnerRevenueTotal = () => nonDraft().reduce((n, i) => n + i.partnerRevenue, 0);

const passRate = (list) => {
  const decided = list.filter((s) => s.status === "PASSED" || s.status === "FAILED");
  if (decided.length === 0) return "—"; // Guard the zero.
  return Math.round((decided.filter((s) => s.status === "PASSED").length / decided.length) * 100) + "%";
};

function notice(kind, text) {
  S.notice = { kind, text };
}

function noticeHtml() {
  if (!S.notice) return "";
  const cls = { ok: "notice-ok", bad: "notice-bad", info: "notice-info" }[S.notice.kind];
  return `<div class="notice ${cls}" role="status">${esc(S.notice.text)}</div>`;
}

/* ============================================================== rendering */

function render() {
  const root = $("#root");
  if (S.screen === "signin") root.innerHTML = signinScreen();
  else if (S.screen === "onboarding") root.innerHTML = onboardingScreen();
  else if (S.screen === "done") root.innerHTML = doneScreen();
  else if (S.screen === "admin") root.innerHTML = adminShell();
  else if (S.screen === "partner") root.innerHTML = partnerShell();
  $("#proto-role").textContent =
    S.identity ? `${S.identity.name} · ${S.identity.kind === "ADMIN" ? "GIMI staff" : partnerName(S.identity.partnerId)}` : "not signed in";

  // Rebuilding the screen destroys the focused element, so a search box would lose
  // focus after every keystroke. Put it back, caret at the end.
  if (S.focus) {
    const field = $("#" + S.focus);
    S.focus = null;
    if (field) {
      field.focus();
      const end = field.value.length;
      field.setSelectionRange(end, end);
      return; // Keep the caret where it is rather than jumping to the top.
    }
  }

  window.scrollTo(0, 0); // Lesson 15: reset scroll on view change.
}

/* ------------------------------------------------------------- sign in */

function signinScreen() {
  return `
  <div class="centre-screen">
    <div class="card-narrow">
      <div class="logo-centre"><img src="gimi-logo.png" alt="GIMI Institute"></div>
      <div class="panel">
        <div class="panel-head centre">
          <h1>Partner Portal</h1>
          <p>Sign in with the email address GIMI invited.</p>
        </div>
        ${noticeHtml()}
        <label class="field"><span>Email</span><input type="email" id="si-email" value="admin@gimi.org"></label>
        <label class="field"><span>Password</span><input type="password" id="si-pass" value="••••••••••••"></label>
        <button class="btn btn-block" data-action="signin-admin">Sign in</button>
        <p style="margin-top:16px;text-align:center;font-size:12px;color:var(--faint)">
          One form for both roles. There is no picker: the role comes from the account.
        </p>
        <div class="panel-head" style="border-bottom:0;border-top:1px solid var(--line-soft);margin:18px 0 0;padding:16px 0 0">
          <p style="font-size:12px;color:var(--muted);margin-bottom:10px">Prototype shortcuts</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" data-action="signin-admin">Sign in as GIMI staff</button>
            <button class="btn btn-ghost btn-sm" data-action="signin-partner">Sign in as a partner</button>
          </div>
        </div>
      </div>
      <p style="margin-top:18px;text-align:center;font-size:11.5px;color:var(--faint)">
        Access is by invitation from GIMI.
      </p>
    </div>
  </div>`;
}

/* ---------------------------------------------- invitation onboarding */

function onboardingScreen() {
  const p = partner(S.onboardingPartnerId);
  const invite = DB.invites.find((i) => i.partnerId === S.onboardingPartnerId);
  return `
  <div class="centre-screen">
    <div class="card-wide">
      <div class="logo-centre"><img src="gimi-logo.png" alt="GIMI Institute"></div>
      <div class="panel">
        <div class="panel-head">
          <h1>Complete your setup</h1>
          <p>Choose a password and confirm your organisation's details. GIMI will activate your access afterwards.</p>
        </div>
        ${noticeHtml()}
        <div class="notice notice-info">Setting up access for <strong>${esc(invite?.email ?? "invited@example.com")}</strong></div>

        <fieldset>
          <legend>Your organisation</legend>
          <label class="field">
            <span>Company name</span>
            <input type="text" id="ob-company" value="${esc(p?.name ?? "")}">
            <span class="hint">Change this if GIMI recorded it differently.</span>
          </label>
          <div class="grid-2">
            <label class="field"><span>Country</span><input type="text" id="ob-country" placeholder="Japan"></label>
            <label class="field"><span>Phone <span class="optional">(optional)</span></span><input type="text" id="ob-phone"></label>
            <label class="field"><span>Website <span class="optional">(optional)</span></span><input type="text" id="ob-website" placeholder="https://"></label>
            <label class="field"><span>LinkedIn <span class="optional">(optional)</span></span><input type="text" id="ob-linkedin" placeholder="https://"></label>
          </div>
          <label class="field">
            <span>Annual revenue target <span class="optional">(optional)</span></span>
            <input type="text" id="ob-target" placeholder="120000">
            <span class="hint">Your own target, in US dollars. GIMI records it for context only.</span>
          </label>
        </fieldset>

        <fieldset class="fieldset-split">
          <legend>Your login</legend>
          <label class="field"><span>Your full name</span><input type="text" id="ob-name"></label>
          <div class="grid-2">
            <label class="field"><span>Password</span><input type="password" id="ob-p1"><span class="hint">At least 12 characters.</span></label>
            <label class="field"><span>Repeat password</span><input type="password" id="ob-p2"></label>
          </div>
        </fieldset>

        <button class="btn btn-block" data-action="onboard-submit">Complete setup</button>
      </div>
    </div>
  </div>`;
}

function doneScreen() {
  return `
  <div class="centre-screen">
    <div class="card-narrow">
      <div class="logo-centre"><img src="gimi-logo.png" alt="GIMI Institute"></div>
      <div class="panel" style="text-align:center">
        <h1 style="color:var(--teal-dark);font-size:17px">Setup complete</h1>
        <p style="color:var(--muted);font-size:13px;margin-top:12px">
          Your password is set and your details are saved. GIMI will review and activate
          your access, and you will be able to sign in once they have.
        </p>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:22px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" data-action="goto-signin">Go to sign in</button>
          <button class="btn btn-sm" data-action="signin-admin">Continue as GIMI staff to approve</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ============================================================ admin shell */

const ADMIN_TABS = [
  ["overview", "Overview"],
  ["partners", "Partners"],
  ["students", "Students"],
  ["invoices", "Invoices"],
  ["leads", "Leads"],
  ["recognition", "Recognition"],
];

function adminShell() {
  // A selected partner takes over the whole area rather than expanding a row, so one
  // partner is on screen at a time instead of the table growing under your cursor.
  const body = S.partnerPage
    ? partnerPage(S.partnerPage)
    : S.leadPage
    ? leadPage(S.leadPage)
    : S.submissionPage
    ? submissionPage(S.submissionPage)
    : {
        overview: adminOverview,
        partners: adminPartners,
        students: adminStudents,
        invoices: adminInvoices,
        leads: adminLeads,
        recognition: adminRecognition,
      }[S.adminTab]();

  return `
  <header class="app-header">
    <img src="gimi-logo-white.png" alt="GIMI Institute">
    <div class="who">
      <span>${esc(S.identity.email)}</span>
      <button data-action="signout">Sign out</button>
    </div>
  </header>
  <nav class="tabs" aria-label="Admin sections">
    <ul>${ADMIN_TABS.map(([k, label]) =>
      `<li><button data-action="admin-tab" data-tab="${k}" ${S.adminTab === k ? 'aria-current="page"' : ""}>${label}</button></li>`,
    ).join("")}</ul>
  </nav>
  <main class="app-main">${noticeHtml()}${body}</main>
  ${modalHtml()}`;
}

/* -------------------------------------------------------- admin: overview */

function adminOverview() {
  const subsPending = DB.submissions.filter((s) => s.status === "PENDING");
  const invitesOutstanding = DB.partners.filter((p) => p.status === "INVITED");
  const reported = DB.invoices.filter((i) => i.status === "PAYMENT_REPORTED");
  const unreviewedLeads = DB.leads.filter((l) => !l.reviewed);
  const drafts = DB.invoices.filter((i) => i.status === "DRAFT");

  // Money late is the most urgent thing on the screen, so it leads.
  const overdue = DB.invoices.filter(
    (i) => (i.status === "SENT" || i.status === "PAYMENT_REPORTED") && i.dueDate < TODAY,
  );
  const overdueTotal = overdue.reduce((n, i) => n + i.gimiAmount, 0);

  const items = [];
  if (overdue.length) items.push([`${overdue.length} invoice${overdue.length > 1 ? "s" : ""} overdue, ${money(overdueTotal)} outstanding`, "invoices"]);
  if (reported.length) items.push([`${reported.length} reported payment${reported.length > 1 ? "s" : ""} to confirm`, "invoices"]);
  if (subsPending.length) items.push([`${subsPending.length} submission${subsPending.length > 1 ? "s" : ""} waiting to be processed`, "students"]);
  if (drafts.length) items.push([`${drafts.length} draft invoice${drafts.length > 1 ? "s" : ""} not yet sent`, "invoices"]);
  if (invitesOutstanding.length) items.push([`${invitesOutstanding.length} invitation${invitesOutstanding.length > 1 ? "s" : ""} not yet accepted`, "partners"]);
  if (unreviewedLeads.length) items.push([`${unreviewedLeads.length} new lead${unreviewedLeads.length > 1 ? "s" : ""} to review`, "leads"]);

  const statusList = items.length
    ? items.map(([text, tab]) => `
        <div class="status-row">
          <span>${esc(text)}</span>
          <button class="btn btn-ghost btn-sm" data-action="admin-tab" data-tab="${tab}">Open</button>
        </div>`).join("")
    : `<div class="status-row clear"><span>Nothing needs your attention.</span></div>`;

  // Year-scoped. Network counts are current state: there is no such thing as an
  // active partner "in 2025", so those two cards stay outside the filter.
  const students = studentsInYear();
  const invoices = invoicesInYear();
  const leads = leadsInYear();

  // Last year's equivalents, for the comparison line under each figure.
  const prev = previousYear();
  const pStudents = prev ? studentsIn(prev) : [];
  const pInvoices = prev ? invoicesIn(prev) : [];
  const pLeads = prev ? leadsIn(prev) : [];
  const pInvoiced = pInvoices.reduce((n, i) => n + i.gimiAmount, 0);
  const pReceived = pInvoices.filter((i) => i.status === "PAID").reduce((n, i) => n + i.gimiAmount, 0);

  const countries = new Set(DB.partners.filter((p) => p.status === "ACTIVE").map((p) => p.country)).size;
  const invoiced = invoices.reduce((n, i) => n + i.gimiAmount, 0);
  const received = invoices.filter((i) => i.status === "PAID").reduce((n, i) => n + i.gimiAmount, 0);

  const byCert = {};
  students.forEach((s) => { byCert[s.cert] = (byCert[s.cert] ?? 0) + 1; });
  const certRows = Object.entries(byCert).sort((a, b) => b[1] - a[1]);

  return `
  <div class="page-head section-head">
    <h1>Overview</h1>
    <label style="display:flex;align-items:center;gap:8px;font-size:13px">
      <span style="color:var(--muted)">Year</span>
      <select data-action="set-year" style="width:auto;padding:5px 8px">
        ${YEARS.map((y) => `<option value="${y}" ${S.year === y ? "selected" : ""}>${y}</option>`).join("")}
      </select>
    </label>
  </div>

  <section class="block">
    <h2>Needs attention</h2>
    <div class="status-list">${statusList}</div>
  </section>

  <section class="block block-plain">
    <div class="kpi-group">
      <h3>Network</h3>
      <div class="kpi-row">
        ${kpi("network", "Active partners", DB.partners.filter((p) => p.status === "ACTIVE").length, "Partners who can sign in today. Not affected by the year filter.")}
        ${kpi("network", "Countries", countries, "Countries represented by active partners.")}
        ${kpi("network", "Leads submitted", leads.length, `Leads shared by partners in ${S.year}.`, versus(prev, pLeads.length))}
        ${kpi("network", "Lead pipeline", money(leads.reduce((n, l) => n + l.expectedRevenue, 0)), "Total expected value of those leads, as estimated by the partner.", versus(prev, money(pLeads.reduce((n, l) => n + l.expectedRevenue, 0))))}
      </div>
    </div>
    <div class="kpi-group">
      <h3>Delivery</h3>
      <div class="kpi-row">
        ${kpi("delivery", "Students enrolled", students.length, `Students with an exam date in ${S.year}.`, versus(prev, pStudents.length))}
        ${kpi("delivery", "People certified", students.filter((s) => s.status === "PASSED").length, "Students who passed.", versus(prev, pStudents.filter((s) => s.status === "PASSED").length))}
        ${kpi("delivery", "Pass rate", passRate(students), "Passed divided by passed plus failed. Students still in progress are excluded.", versus(prev, passRate(pStudents)))}
        ${kpi("delivery", "Awaiting enrollment", DB.submissions.filter((s) => s.status === "PENDING").reduce((n, s) => n + s.roster.length, 0), "People sitting in submissions GIMI has not processed yet. A queue, so not year-filtered.")}
      </div>
    </div>
    <div class="kpi-group">
      <h3>Finances</h3>
      <div class="kpi-row">
        <!-- Partner revenue deliberately absent. It is what a partner says it billed its
             own client, so GIMI cannot verify it, and an unverifiable figure standing
             beside three exact ones invites more confidence than it deserves. The number
             still lives on each invoice and in the partner workspace, where it has the
             context that makes it meaningful. -->
        ${kpi("finance", "GIMI invoiced", money(invoiced), "What GIMI billed partners. Entered by hand on each invoice. Drafts excluded.", versus(prev, money(pInvoiced)))}
        ${kpi("finance", "GIMI received", money(received), "Invoices confirmed paid.", versus(prev, money(pReceived)))}
        ${kpi("finance", "Outstanding", money(invoiced - received), "Invoiced minus received.", versus(prev, money(pInvoiced - pReceived)))}
      </div>
    </div>
  </section>

  ${gimiRevenueByPartner(invoices)}

  <section class="block">
    <div class="section-head">
      <h2>Certifications by type</h2>
      <div class="toolbar">
        <button class="btn btn-ghost btn-sm" data-action="csv-certifications" ${certRows.length === 0 ? "disabled" : ""}>Download CSV</button>
      </div>
    </div>
    <div class="table-scroll"><table>
      <thead><tr>
        <th>Certification</th><th>Group</th><th class="num">Students</th><th class="num">Share</th>
      </tr></thead>
      <tbody>${DB.catalogue.map((c) => {
        const n = byCert[c.name] ?? 0;
        const pct = students.length ? Math.round((n / students.length) * 100) : 0;
        return `
        <tr${n === 0 ? ' style="color:var(--faint)"' : ""}>
          <td>${c.lmsLink
            ? `<a href="${esc(c.lmsLink)}" target="_blank" rel="noopener">${esc(c.name)}</a>`
            : esc(c.name)}</td>
          <td>${esc(c.group)}</td>
          <td class="num">${n || "—"}</td>
          <td class="num">${n ? pct + "%" : "—"}</td>
        </tr>`;
      }).join("")}
      </tbody>
    </table></div>
  </section>`;
}

/**
 * A KPI card. The definition goes in a tooltip on the label, not as prose on the
 * page: this is a screen a client may see, and paragraphs under numbers read as
 * filler. Hovering the label explains the figure.
 */
const kpi = (cls, label, value, explain = "", compare = "") =>
  `<dl class="kpi ${cls}">
     <dt${explain ? ` title="${esc(explain)}" style="cursor:help;border-bottom:1px dotted #c9ced4;display:inline-block"` : ""}>${esc(label)}</dt>
     <dd>${esc(String(value))}</dd>
     ${compare ? `<dd class="kpi-compare">${esc(compare)}</dd>` : ""}
   </dl>`;

/**
 * The same figure a year earlier, for the cards the year filter drives.
 *
 * Deliberately no arrows and no red or green. "Outstanding up 40%" is bad news and
 * "certified up 40%" is good news, and a single colour scheme cannot tell them
 * apart. Showing last year's number lets the reader judge.
 */
const versus = (year, value) => (year ? `${year}: ${value}` : "");

/**
 * What GIMI earns, partner by partner. Drafts are excluded, so this only counts
 * invoices that were actually issued.
 *
 * Every figure is a sum of the gimiAmount an admin typed on each invoice. Nothing
 * here is derived from a rate, because the rate is not the same for every partner:
 * see the note in the Overview about why.
 */
function gimiRevenueByPartner(invoices) {
  const rows = DB.partners
    .map((p) => {
      const issued = invoices.filter((i) => i.partnerId === p.id);
      return {
        p,
        certificates: issued.reduce((n, i) => n + i.studentCount, 0),
        invoiced: issued.reduce((n, i) => n + i.gimiAmount, 0),
        received: issued.filter((i) => i.status === "PAID").reduce((n, i) => n + i.gimiAmount, 0),
      };
    })
    .filter((r) => r.invoiced > 0)
    .sort((a, b) => b.invoiced - a.invoiced);

  const totalInvoiced = rows.reduce((n, r) => n + r.invoiced, 0);
  const totalReceived = rows.reduce((n, r) => n + r.received, 0);
  const bold = "border-top:1px solid var(--line);font-weight:600";

  return `
  <section class="block">
    <div class="section-head">
      <h2>GIMI revenue by partner</h2>
      <div class="toolbar">
        <button class="btn btn-ghost btn-sm" data-action="csv-revenue" ${rows.length === 0 ? "disabled" : ""}>Download CSV</button>
      </div>
    </div>
    ${rows.length === 0
      ? `<div class="empty">No invoices were issued in ${esc(S.year)}.</div>`
      : `<div class="table-scroll"><table>
      <thead><tr>
        <th>Partner</th><th>Country</th><th class="num">Certificates</th>
        <th class="num">GIMI invoiced</th><th class="num">Received</th><th class="num">Outstanding</th>
      </tr></thead>
      <tbody>${rows.map((r) => `
        <tr>
          <td>${esc(r.p.name)}</td>
          <td>${esc(r.p.country)}</td>
          <td class="num">${r.certificates}</td>
          <td class="num">${money(r.invoiced)}</td>
          <td class="num">${money(r.received)}</td>
          <td class="num">${money(r.invoiced - r.received)}</td>
        </tr>`).join("")}
      </tbody>
      <tfoot><tr>
        <td colspan="2" style="${bold}">Total</td>
        <td class="num" style="${bold}">${rows.reduce((n, r) => n + r.certificates, 0)}</td>
        <td class="num" style="${bold}">${money(totalInvoiced)}</td>
        <td class="num" style="${bold}">${money(totalReceived)}</td>
        <td class="num" style="${bold}">${money(totalInvoiced - totalReceived)}</td>
      </tr></tfoot>
    </table></div>`}
  </section>`;
}

/* -------------------------------------------------------- admin: partners */

/** Search across the fields someone would actually type: name, country, region, email. */
function partnerMatches(p, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    p.name.toLowerCase().includes(q) ||
    p.country.toLowerCase().includes(q) ||
    p.region.toLowerCase().includes(q) ||
    p.partnerType.toLowerCase().includes(q) ||
    p.users.some((u) => u.email.toLowerCase().includes(q))
  );
}

function filteredPartners() {
  return DB.partners.filter(
    (p) =>
      partnerMatches(p, S.partnerSearch) &&
      (S.partnerStatus === "ALL" || p.status === S.partnerStatus) &&
      (S.partnerRegion === "ALL" || p.region === S.partnerRegion),
  );
}

function adminPartners() {
  const shown = filteredPartners();
  const awaiting = shown.filter((p) => p.status === "INVITED");
  const rest = shown.filter((p) => p.status !== "INVITED");
  const cols = DB.customColumns;
  const regions = [...new Set(DB.partners.map((p) => p.region))].sort();
  const filtering =
    S.partnerSearch || S.partnerStatus !== "ALL" || S.partnerRegion !== "ALL";

  return `
  <div class="page-head section-head">
    <div>
      <h1>Partners</h1>
      <p class="count">Showing ${shown.length} of ${DB.partners.length}.</p>
    </div>
    <div class="toolbar">
      <input type="text" id="partner-search" data-action="partner-search" placeholder="Search partners"
        value="${esc(S.partnerSearch)}" style="width:200px;padding:6px 9px">
      <select data-action="partner-status" style="width:auto;padding:6px 8px">
        <option value="ALL" ${S.partnerStatus === "ALL" ? "selected" : ""}>All statuses</option>
        <option value="ACTIVE" ${S.partnerStatus === "ACTIVE" ? "selected" : ""}>Active</option>
        <option value="INVITED" ${S.partnerStatus === "INVITED" ? "selected" : ""}>Invitation sent</option>
        <option value="SUSPENDED" ${S.partnerStatus === "SUSPENDED" ? "selected" : ""}>Suspended</option>
      </select>
      <select data-action="partner-region" style="width:auto;padding:6px 8px">
        <option value="ALL" ${S.partnerRegion === "ALL" ? "selected" : ""}>All regions</option>
        ${regions.map((r) => `<option value="${esc(r)}" ${S.partnerRegion === r ? "selected" : ""}>${esc(r)}</option>`).join("")}
      </select>
      ${filtering ? `<button class="btn btn-ghost btn-sm" data-action="clear-partner-filters">Clear</button>` : ""}
      <button class="btn btn-ghost btn-sm" data-action="csv-partners" ${shown.length === 0 ? "disabled" : ""}>Download CSV</button>
    </div>
  </div>

  <div class="adder">
    <div class="adder-head">
      <h2>Add a partner</h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" data-action="manage-columns">Manage columns</button>
        <button class="btn btn-sm" data-action="toggle-open" data-id="add-partner">
          ${S.open["add-partner"] ? "Cancel" : "+ Add partner"}
        </button>
      </div>
    </div>
    ${S.open["add-partner"] ? `
      <div class="adder-body">
        <div class="grid-2">
          <label class="field"><span>Company name</span><input type="text" id="ap-name" placeholder="Kyoto Innovation Partners"></label>
          <label class="field"><span>Email to invite</span><input type="email" id="ap-email" placeholder="director@example.com"></label>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <button class="btn btn-sm" data-action="add-partner">Send invitation</button>
          <span style="font-size:11.5px;color:var(--faint)">They set their own password and fill in the rest.</span>
        </div>
      </div>` : ""}
  </div>

  ${awaiting.length ? `
    <section class="block">
      <h2>Invitation sent, not yet accepted (${awaiting.length})</h2>
      ${partnerTable(awaiting, cols)}
    </section>` : ""}

  <section class="block">
    <h2>${S.partnerStatus === "ALL" ? "All partners" : "Partners"} (${rest.length})</h2>
    ${rest.length
      ? partnerTable(rest, cols)
      : `<div class="empty">${filtering
          ? "No partners match these filters."
          : "No partners yet."}</div>`}
  </section>`;
}

function partnerTable(rows, cols) {
  return `
  <div class="table-scroll"><table>
    <thead><tr>
      <th>Partner</th><th>Status</th><th>Country</th><th>Region</th><th>Type</th><th>Logins</th>
      <th class="num">Target</th>
      ${cols.map((c) => `<th>${esc(c.name)}</th>`).join("")}
      <th class="right">Actions</th>
    </tr></thead>
    <tbody>
      ${rows.map((p) => {
        const invite = DB.invites.find((i) => i.partnerId === p.id);
        return `
        <tr>
          <td>
            <button class="btn-link" data-action="open-partner" data-id="${p.id}">${esc(p.name)}</button>
            ${invite ? `<span class="sub">Sent to ${esc(invite.email)} on ${date(invite.sentAt)}, expires ${date(invite.expiresAt)}</span>` : ""}
          </td>
          <td>${partnerBadge(p.status)}</td>
          <td>${esc(p.country || "—")}</td>
          <td>${esc(p.region || "—")}</td>
          <td>${esc(p.partnerType || "—")}</td>
          <td>${p.users.length === 0 ? `<span style="color:var(--faint)">None yet</span>` : p.users.map((u) => `<span class="sub" style="margin:0">${esc(u.email)}</span>`).join("")}</td>
          <td class="num">${money(p.expectedRevenue)}</td>
          ${cols.map((c) => `<td>${esc(p.notes[c.id] || "—")}</td>`).join("")}
          <td>
            <div class="row-actions">
              ${invite ? `<button class="btn btn-ghost btn-sm" data-action="resend-invite" data-id="${p.id}">Resend invite</button>` : ""}
              ${p.status === "ACTIVE" ? `<button class="btn btn-danger btn-sm" data-action="suspend" data-id="${p.id}">Suspend</button>` : ""}
              ${p.status === "SUSPENDED" ? `<button class="btn btn-ghost btn-sm" data-action="reactivate" data-id="${p.id}">Reactivate</button>` : ""}
            </div>
          </td>
        </tr>`;
      }).join("")}
    </tbody>
  </table></div>`;
}

/**
 * One partner, on their own page. Opened from the Partners table and closed back to
 * it, so the table never grows under the cursor and only one partner is ever on
 * screen.
 *
 * Everything here is year-filtered except the managed columns and the comments,
 * which describe the relationship rather than a period.
 */
function partnerPage(id) {
  const p = partner(id);
  if (!p) { S.partnerPage = null; return adminPartners(); }

  const cols = DB.customColumns;

  const subs = DB.submissions.filter((s) => s.partnerId === id && inYearOf(s.submittedAt, S.year));
  const students = DB.students.filter((s) => s.partnerId === id && inYearOf(s.examDate, S.year));
  const invoices = DB.invoices.filter((i) => i.partnerId === id && (i.status === "DRAFT" || inYearOf(i.issuedAt, S.year)));
  const leads = DB.leads.filter((l) => l.partnerId === id && inYearOf(l.submittedAt, S.year));

  const issued = invoices.filter((i) => i.status !== "DRAFT");
  const invoiced = issued.reduce((n, i) => n + i.gimiAmount, 0);
  const received = issued.filter((i) => i.status === "PAID").reduce((n, i) => n + i.gimiAmount, 0);
  const requested = subs.reduce((n, s) => n + s.roster.length, 0);

  return `
  <div style="margin-bottom:18px">
    <button class="btn-link" data-action="close-partner">← All partners</button>
  </div>

  <div class="page-head section-head">
    <div>
      <h1>${esc(p.name)}</h1>
      <p class="count">
        ${esc(p.country)} · ${esc(p.region)} · ${esc(p.partnerType)} · ${partnerBadge(p.status)}
      </p>
    </div>
    <div class="toolbar">
      <label style="display:flex;align-items:center;gap:8px;font-size:13px">
        <span style="color:var(--muted)">Year</span>
        <select data-action="set-year" style="width:auto;padding:5px 8px">
          ${YEARS.map((y) => `<option value="${y}" ${S.year === y ? "selected" : ""}>${y}</option>`).join("")}
        </select>
      </label>
      <button class="btn btn-sm" data-action="new-invoice" data-id="${id}">+ New invoice</button>
      ${p.status === "ACTIVE" ? `<button class="btn btn-danger btn-sm" data-action="suspend" data-id="${id}">Suspend</button>` : ""}
      ${p.status === "SUSPENDED" ? `<button class="btn btn-ghost btn-sm" data-action="reactivate" data-id="${id}">Reactivate</button>` : ""}
    </div>
  </div>

  <section class="block block-plain">
    <div class="kpi-group">
      <h3>Delivery</h3>
      <div class="kpi-row">
        ${kpi("delivery", "Asked to enroll", requested, `People this partner submitted for enrollment in ${S.year}.`)}
        ${kpi("delivery", "Enrolled", students.length, `Students with an exam date in ${S.year}.`)}
        ${kpi("delivery", "Certified", students.filter((s) => s.status === "PASSED").length, "Students who passed.")}
        ${kpi("delivery", "Pass rate", passRate(students), "Passed divided by passed plus failed.")}
      </div>
    </div>
    <div class="kpi-group">
      <h3>Finances</h3>
      <div class="kpi-row">
        ${kpi("finance", "GIMI invoiced", money(invoiced), "Drafts excluded.")}
        ${kpi("finance", "GIMI received", money(received), "Confirmed paid.")}
        ${kpi("finance", "Outstanding", money(invoiced - received), "Invoiced minus received.")}
      </div>
    </div>
  </section>

  <div class="two-col">
    <section class="block">
      <div class="section-head">
        <h2>Relationship</h2>
        <div class="toolbar">
          <button class="btn btn-ghost btn-sm" data-action="manage-columns">Manage columns</button>
        </div>
      </div>
      ${cols.map((c) => `
        <label class="field">
          <span>${esc(c.name)}</span>
          <input type="text" value="${esc(p.notes[c.id] || "")}" data-note="${id}:${c.id}">
        </label>`).join("")}
    </section>

    <section class="block">
      <h2>Comments</h2>
      <label class="field">
        <textarea id="pc-text" placeholder="Anything worth recording about this partner"></textarea>
      </label>
      <button class="btn btn-sm" data-action="add-partner-comment">Add comment</button>
      <div style="margin-top:14px">
        ${p.comments.length === 0
          ? `<div class="empty" style="padding:18px">Nothing recorded yet.</div>`
          : p.comments.map((c) => `
            <div style="border:1px solid var(--line);border-radius:var(--radius-sm);padding:11px 13px;margin-bottom:8px">
              <p style="font-size:11.5px;color:var(--faint);margin-bottom:4px">${esc(c.author)} · ${date(c.when)}</p>
              <p style="font-size:13px">${esc(c.text)}</p>
            </div>`).join("")}
      </div>
    </section>
  </div>

  <section class="block">
    <h2>Enrollment submissions (${subs.length})</h2>
    ${subs.length === 0 ? `<div class="empty">Nothing submitted in ${esc(S.year)}.</div>` : `
      <div class="table-scroll"><table>
        <thead><tr><th>File</th><th class="num">People</th><th>Sent</th><th>Status</th><th class="right">Actions</th></tr></thead>
        <tbody>${subs.map((s) => `
          <tr>
            <td>${esc(s.fileName)}</td>
            <td class="num">${s.roster.length}</td>
            <td class="nowrap">${date(s.submittedAt)}</td>
            <td>${badge(SUBMISSION_STATUS[s.status], s.status === "PROCESSED" ? "badge-paid" : s.status === "REJECTED" ? "badge-suspended" : "badge-pending")}</td>
            <td><div class="row-actions">
              ${s.status === "PENDING" ? `<button class="btn btn-ghost btn-sm" data-action="admin-tab" data-tab="students">Open in Students</button>` : ""}
            </div></td>
          </tr>`).join("")}
        </tbody>
      </table></div>`}
  </section>

  <section class="block">
    <h2>Invoices (${invoices.length})</h2>
    ${invoices.length === 0 ? `<div class="empty">No invoices in ${esc(S.year)}.</div>` : `
      <div class="table-scroll"><table>
        <thead><tr><th>Description</th><th class="num">People</th><th class="num">Partner revenue</th><th class="num">GIMI amount</th><th>Status</th><th>Due</th></tr></thead>
        <tbody>${invoices.map((i) => `
          <tr>
            <td>${esc(i.description)}${i.pdf ? `<span class="sub">${esc(i.pdf)}</span>` : `<span class="sub">No PDF attached</span>`}</td>
            <td class="num">${i.studentCount}</td>
            <td class="num">${money(i.partnerRevenue)}</td>
            <td class="num">${money(i.gimiAmount)}</td>
            <td>${invoiceBadge(i.status)}</td>
            <td class="nowrap">${date(i.dueDate)}</td>
          </tr>`).join("")}
        </tbody>
      </table></div>`}
  </section>

  <section class="block">
    <h2>Leads (${leads.length})</h2>
    ${leads.length === 0 ? `<div class="empty">No leads shared in ${esc(S.year)}.</div>` : `
      <div class="table-scroll"><table>
        <thead><tr><th>Company</th><th>Stage</th><th>Probability</th><th>Met</th><th>Docs sent</th><th class="num">Expected</th><th>Reviewed</th></tr></thead>
        <tbody>${leads.map((l) => `
          <tr>
            <td><button class="btn-link" data-action="open-lead" data-id="${l.id}">${esc(l.company)}</button>
          <span class="sub">${esc(l.contact)}${l.documents.length ? ` · ${l.documents.length} document${l.documents.length > 1 ? "s" : ""} from GIMI` : ""}</span></td>
            <td>${esc(LEAD_STAGE[l.stage])}</td>
            <td>${esc(l.probability)}</td>
            <td>${esc(MET_STATUS[l.metStatus])}</td>
            <td>${esc(DOCS_SENT[l.docsSent])}</td>
            <td class="num">${money(l.expectedRevenue)}</td>
            <td>${l.reviewed ? badge("Yes", "badge-paid") : badge("No", "badge-pending")}</td>
          </tr>`).join("")}
        </tbody>
      </table></div>`}
  </section>

  <section class="block">
    <h2>Logins (${p.users.length})</h2>
    ${p.users.length === 0
      ? `<div class="empty">Nobody has completed the invitation yet.</div>`
      : `<div class="table-scroll"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Last signed in</th></tr></thead>
        <tbody>${p.users.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td class="nowrap">${date(u.lastLogin)}</td></tr>`).join("")}</tbody>
      </table></div>`}
  </section>`;
}

/**
 * One submission, on its own page. This is where GIMI reads every person before
 * anyone is enrolled, so it gets a page rather than a row that unfolds inside a
 * table. The point is seeing who you are approving.
 */
function submissionPage(id) {
  const sub = DB.submissions.find((s) => s.id === id);
  if (!sub) { S.submissionPage = null; return adminStudents(); }

  const bad = sub.roster.filter(rowIncomplete);
  const blocked = bad.length > 0;

  return `
  <div style="margin-bottom:18px">
    <button class="btn-link" data-action="close-submission">← All submissions</button>
  </div>

  <div class="page-head section-head">
    <div>
      <h1>${esc(sub.fileName)}</h1>
      <p class="count">
        ${esc(partnerName(sub.partnerId))} · sent ${date(sub.submittedAt)}
        · ${sub.roster.length} ${sub.roster.length === 1 ? "person" : "people"}
        · ${badge(SUBMISSION_STATUS[sub.status], sub.status === "PROCESSED" ? "badge-paid" : sub.status === "REJECTED" ? "badge-suspended" : "badge-pending")}
      </p>
    </div>
    ${sub.status === "PENDING" ? `<div class="toolbar">
      <button class="btn btn-sm" data-action="confirm-sub" data-id="${sub.id}" ${blocked ? "disabled" : ""}>Confirm and enroll ${sub.roster.length}</button>
      <button class="btn btn-danger btn-sm" data-action="open-reject-sub" data-id="${sub.id}">Reject</button>
    </div>` : ""}
  </div>

  ${blocked ? `<div class="notice notice-bad">
    ${bad.length} of ${sub.roster.length} rows are missing a required field, so this cannot be
    confirmed. The partner fixes their own data; the rows are marked below.
  </div>` : ""}

  ${sub.rejectedReason ? `<div class="notice notice-info">Rejected: ${esc(sub.rejectedReason)}</div>` : ""}

  <section class="block">
    <h2>Everyone in this submission (${sub.roster.length})</h2>
    <div class="table-scroll"><table>
      <thead><tr>
        <th>First</th><th>Last</th><th>Email</th><th>Certification</th>
        <th>Exam date</th><th>Format</th><th>Language</th><th>Company</th>
      </tr></thead>
      <tbody>${sub.roster.map((r) => `
        <tr${rowIncomplete(r) ? ' style="background:rgba(240,135,30,.07)"' : ""}>
          <td>${esc(r.first) || missing()}</td>
          <td>${esc(r.last) || missing()}</td>
          <td>${esc(r.email) || missing()}</td>
          <td>${esc(r.cert) || missing()}</td>
          <td class="nowrap">${r.examDate ? date(r.examDate) : missing()}</td>
          <td>${esc(EXAM_FORMATS.find((f) => f.value === r.format)?.label ?? "—")}</td>
          <td>${esc(r.lang || "—")}</td>
          <td>${esc(r.company || "—")}</td>
        </tr>`).join("")}
      </tbody>
    </table></div>
  </section>`;
}

/* ------------------------------------------------------ students: filtering */

function filteredStudents() {
  const q = S.studentSearch.toLowerCase();
  return DB.students.filter(
    (s) =>
      (!q ||
        `${s.first} ${s.last}`.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        partnerName(s.partnerId).toLowerCase().includes(q)) &&
      (S.studentPartner === "ALL" || s.partnerId === S.studentPartner) &&
      (S.studentCert === "ALL" || s.cert === S.studentCert) &&
      (S.studentStatus === "ALL" || s.status === S.studentStatus) &&
      (S.studentYear === "ALL" || inYearOf(s.examDate, S.studentYear)),
  );
}

function adminStudents() {
  const pending = DB.submissions.filter((s) => s.status === "PENDING");
  const shown = filteredStudents();
  const filtering =
    S.studentSearch || S.studentPartner !== "ALL" || S.studentCert !== "ALL" ||
    S.studentStatus !== "ALL" || S.studentYear !== "ALL";

  // Only certifications somebody is actually enrolled on, so the filter is usable.
  const certsInUse = [...new Set(DB.students.map((s) => s.cert))].sort();
  const partnersInUse = [...new Set(DB.students.map((s) => s.partnerId))]
    .map((id) => ({ id, name: partnerName(id) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return `
  <div class="page-head">
    <h1>Students</h1>
    <p class="count">${DB.students.length} enrolled across the network.</p>
  </div>

  <section class="block">
    <h2>Submissions to process (${pending.length})</h2>
    ${pending.length === 0 ? `<div class="empty">Nothing waiting. Submissions appear here when a partner sends a roster.</div>` : `
      <div class="table-scroll"><table>
        <thead><tr><th>Partner</th><th>File</th><th class="num">People</th><th>Received</th><th>Completeness</th><th class="right">Actions</th></tr></thead>
        <tbody>${pending.map((sub) => {
          const blocked = submissionBlocked(sub);
          const bad = sub.roster.filter(rowIncomplete).length;
          return `
          <tr>
            <td>${esc(partnerName(sub.partnerId))}</td>
            <td><button class="btn-link" data-action="open-submission" data-id="${sub.id}">${esc(sub.fileName)}</button>
                <span class="sub">Read all ${sub.roster.length} people before confirming</span></td>
            <td class="num">${sub.roster.length}</td>
            <td class="nowrap">${date(sub.submittedAt)}</td>
            <td>${blocked
              ? badge(`${bad} row${bad === 1 ? "" : "s"} incomplete`, "badge-pending")
              : badge("Complete", "badge-paid")}</td>
            <td><div class="row-actions">
              <button class="btn btn-sm" data-action="confirm-sub" data-id="${sub.id}" ${blocked ? "disabled" : ""}>Confirm</button>
              <button class="btn btn-danger btn-sm" data-action="open-reject-sub" data-id="${sub.id}">Reject</button>
            </div></td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>`}
  </section>

  <section class="block">
    <div class="section-head">
      <h2>All students (${shown.length} of ${DB.students.length})</h2>
      <div class="toolbar">
        <input type="text" id="student-search" data-action="student-search" placeholder="Search name, email, partner"
          value="${esc(S.studentSearch)}" style="width:210px;padding:6px 9px">
        <select data-action="student-partner" style="width:auto;padding:6px 8px">
          <option value="ALL" ${S.studentPartner === "ALL" ? "selected" : ""}>All partners</option>
          ${partnersInUse.map((p) => `<option value="${p.id}" ${S.studentPartner === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
        </select>
        <select data-action="student-cert" style="width:auto;padding:6px 8px;max-width:230px">
          <option value="ALL" ${S.studentCert === "ALL" ? "selected" : ""}>All certifications</option>
          ${certsInUse.map((c) => `<option value="${esc(c)}" ${S.studentCert === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
        </select>
        <select data-action="student-status" style="width:auto;padding:6px 8px">
          <option value="ALL" ${S.studentStatus === "ALL" ? "selected" : ""}>All results</option>
          ${Object.entries(STUDENT_STATUS).map(([v, l]) => `<option value="${v}" ${S.studentStatus === v ? "selected" : ""}>${l}</option>`).join("")}
        </select>
        <select data-action="student-year" style="width:auto;padding:6px 8px">
          <option value="ALL" ${S.studentYear === "ALL" ? "selected" : ""}>All years</option>
          ${YEARS.map((y) => `<option value="${y}" ${S.studentYear === y ? "selected" : ""}>${y}</option>`).join("")}
        </select>
        ${filtering ? `<button class="btn btn-ghost btn-sm" data-action="clear-student-filters">Clear</button>` : ""}
        <button class="btn btn-ghost btn-sm" data-action="csv-students" ${shown.length === 0 ? "disabled" : ""}>Download CSV</button>
      </div>
    </div>
    ${shown.length === 0
      ? `<div class="empty">${filtering ? "No students match these filters." : "No students enrolled yet."}</div>`
      : `<div class="table-scroll"><table>
      <thead><tr><th>Name</th><th>Partner</th><th>Certification</th><th>Exam date</th><th>Language</th><th>Result</th></tr></thead>
      <tbody>${shown.map((s) => `
        <tr>
          <td>${esc(s.first)} ${esc(s.last)}<span class="sub">${esc(s.email)}</span></td>
          <td>${esc(partnerName(s.partnerId))}</td>
          <td>${esc(s.cert)}</td>
          <td class="nowrap">${date(s.examDate)}</td>
          <td>${esc(s.lang)}</td>
          <td>
            <select data-action="set-result" data-id="${s.id}">
              ${Object.entries(STUDENT_STATUS).map(([v, l]) =>
                `<option value="${v}" ${s.status === v ? "selected" : ""}>${l}</option>`).join("")}
            </select>
            ${s.resultSetBy ? `<span class="sub">${esc(s.resultSetBy)} · ${date(s.resultSetOn)}</span>` : ""}
          </td>
        </tr>`).join("")}
      </tbody>
    </table></div>`}
  </section>`;
}

const missing = () => `<span style="color:var(--pink)">missing</span>`;

/* -------------------------------------------------------- admin: invoices */

/** Rows for the invoice tables. Shared so the pending and full tables cannot drift. */
function invoiceRows(rows) {
  const overdue = (i) => i.status !== "PAID" && i.status !== "DRAFT" && i.dueDate < TODAY;
  return rows.map((i) => `
    <tr>
      <td>${esc(partnerName(i.partnerId))}</td>
      <td>${esc(i.description)}${i.pdf ? `<span class="sub">${esc(i.pdf)}${i.qbRef ? " · " + esc(i.qbRef) : ""}</span>` : `<span class="sub">No invoice attached</span>`}</td>
      <td class="num">${i.studentCount}</td>
      <td class="num">${money(i.partnerRevenue)}</td>
      <td class="num">${money(i.gimiAmount)}</td>
      <td>${invoiceBadge(i.status)}${i.payment ? `<span class="sub">${esc(i.payment.reference)}</span>` : ""}</td>
      <td class="nowrap">${date(i.dueDate)}${overdue(i) ? `<span class="sub" style="color:var(--pink);font-weight:700">Overdue</span>` : ""}</td>
      <td><div class="row-actions">
        ${i.status === "DRAFT" ? `<button class="btn btn-sm" data-action="open-send" data-id="${i.id}">Send</button>` : ""}
        ${i.status === "PAYMENT_REPORTED" ? `
          <button class="btn btn-sm" data-action="confirm-payment" data-id="${i.id}">Funds received</button>
          <button class="btn btn-danger btn-sm" data-action="reject-payment" data-id="${i.id}">Not received</button>` : ""}
        ${i.status === "PAID" ? `<span style="font-size:11.5px;color:var(--faint)">Locked</span>` : ""}
      </div></td>
    </tr>`).join("");
}

const INVOICE_HEAD = `<thead><tr>
  <th>Partner</th><th>Description</th><th class="num">People</th>
  <th class="num">Partner revenue</th><th class="num">GIMI amount</th>
  <th>Status</th><th>Due</th><th class="right">Actions</th>
</tr></thead>`;

function adminInvoices() {
  const byPartner = DB.partners.map((p) => {
    const rows = DB.invoices.filter((i) => i.partnerId === p.id && i.status !== "DRAFT");
    const invoiced = rows.reduce((n, i) => n + i.gimiAmount, 0);
    const received = rows.filter((i) => i.status === "PAID").reduce((n, i) => n + i.gimiAmount, 0);
    return { p, revenue: rows.reduce((n, i) => n + i.partnerRevenue, 0), invoiced, received };
  }).filter((r) => r.invoiced > 0).sort((a, b) => b.invoiced - a.invoiced);

  // The pending band: anything asking for a decision, most urgent first.
  const overdue = DB.invoices.filter((i) => i.status === "SENT" || i.status === "PAYMENT_REPORTED")
    .filter((i) => i.dueDate < TODAY);
  const reported = DB.invoices.filter((i) => i.status === "PAYMENT_REPORTED");
  const drafts = DB.invoices.filter((i) => i.status === "DRAFT");
  const needsAction = [
    ...reported,
    ...drafts,
    ...overdue.filter((i) => i.status !== "PAYMENT_REPORTED"),
  ];

  return `
  <div class="page-head">
    <h1>Invoices</h1>
    <p class="count">${DB.invoices.length} invoices, including drafts.</p>
  </div>

  <div class="adder">
    <div class="adder-head">
      <h2>New invoice</h2>
      <button class="btn btn-sm" data-action="toggle-open" data-id="add-invoice">
        ${S.open["add-invoice"] ? "Cancel" : "+ New invoice"}
      </button>
    </div>
    ${S.open["add-invoice"] ? invoiceForm() : ""}
  </div>

  <section class="block">
    <h2>Needs a decision (${needsAction.length})</h2>
    ${needsAction.length === 0
      ? `<div class="empty">Nothing waiting. Every invoice is either paid or with the partner.</div>`
      : `<div class="table-scroll"><table>${INVOICE_HEAD}<tbody>${invoiceRows(needsAction)}</tbody></table></div>`}
  </section>

  <section class="block">
    <h2>All invoices</h2>
    <div class="table-scroll"><table>${INVOICE_HEAD}<tbody>${invoiceRows(DB.invoices)}</tbody></table></div>
    <div class="legend">
      <span>${invoiceBadge("DRAFT")} invisible to the partner</span>
      <span>${invoiceBadge("SENT")} awaiting payment</span>
      <span>${invoiceBadge("PAYMENT_REPORTED")} partner says paid</span>
      <span>${invoiceBadge("PAID")} confirmed, no longer editable</span>
    </div>
  </section>

  <section class="block">
    <h2>Revenue by partner</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>Partner</th><th class="num">Partner revenue</th><th class="num">GIMI invoiced</th><th class="num">GIMI received</th><th class="num">Outstanding</th></tr></thead>
      <tbody>${byPartner.map((r) => `
        <tr>
          <td>${esc(r.p.name)}</td>
          <td class="num">${money(r.revenue)}</td>
          <td class="num">${money(r.invoiced)}</td>
          <td class="num">${money(r.received)}</td>
          <td class="num">${money(r.invoiced - r.received)}</td>
        </tr>`).join("")}
      </tbody>
    </table></div>
  </section>`;
}

function invoiceForm() {
  return `
  <div class="adder-body">
    <div class="grid-2">
      <label class="field"><span>Partner</span>
        <select id="ni-partner">${DB.partners.filter((p) => p.status === "ACTIVE").map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></label>
      <label class="field"><span>Description</span><input type="text" id="ni-desc" placeholder="Level 1 Associate cohort, September 2026"></label>
      <label class="field"><span>Certification</span>
        <select id="ni-cert">${DB.catalogue.map((c) => `<option value="${esc(c.name)}">${esc(c.name)}${c.certPrice ? ` — ${esc(c.certPrice)}` : ""}</option>`).join("")}</select>
        <span class="hint">Sets the catalogue price used as the guide below.</span></label>
      <label class="field"><span>People</span><input type="number" id="ni-count" value="1" min="1"></label>
      <label class="field"><span>Partner revenue</span><input type="text" id="ni-rev" placeholder="6720">
        <span class="hint">The full certificate value the partner billed its client.</span></label>
      <label class="field"><span>GIMI amount</span><input type="text" id="ni-gimi" placeholder="4032">
        <span class="hint">What GIMI invoices them. Typed in, never calculated.</span></label>
      <label class="field"><span>Due date</span><input type="date" id="ni-due" value="2026-09-30"></label>
      <label class="field">
        <span>Invoice PDF from QuickBooks</span>
        <input type="file" id="ni-file" accept="application/pdf,image/*">
        <span class="hint">Attached now. The partner downloads this exact file once it is sent.</span>
      </label>
    </div>
    <label class="field"><span>QuickBooks reference <span class="optional">(optional)</span></span>
      <input type="text" id="ni-qb" placeholder="QB-1070" style="max-width:220px"></label>
    <button class="btn btn-sm" data-action="create-invoice">Create as draft</button>
    <span style="font-size:11.5px;color:var(--faint);margin-left:10px">Drafts are never visible to the partner.</span>
  </div>`;
}

/* ----------------------------------------------------------- admin: leads */

/**
 * One lead, on its own page. The same page for both sides, because GIMI and the
 * partner need to be looking at the same thing when they talk about it. What differs
 * is who can do what: GIMI attaches documents and marks the lead reviewed, the
 * partner reads and downloads. Both can comment.
 *
 * This is where documents reach the partner. GIMI attaches the case study and the
 * course outline here, and the partner downloads them to use in front of the client.
 */
function leadPage(id) {
  const l = DB.leads.find((x) => x.id === id);
  const isAdmin = S.identity.kind === "ADMIN";

  // A partner may only ever open their own lead. Checked here, not by hiding a link.
  if (!l || (!isAdmin && l.partnerId !== myId())) {
    S.leadPage = null;
    return isAdmin ? adminLeads() : partnerLeads();
  }

  return `
  <div style="margin-bottom:18px">
    <button class="btn-link" data-action="close-lead">← ${isAdmin ? "All leads" : "Your leads"}</button>
  </div>

  <div class="page-head section-head">
    <div>
      <h1>${esc(l.company)}</h1>
      <p class="count">
        ${esc(l.contact)}${l.website ? ` · ${esc(l.website)}` : ""}
        ${isAdmin ? ` · shared by ${esc(partnerName(l.partnerId))}` : ""}
        · shared ${date(l.submittedAt)}
        · ${l.reviewed ? badge("Reviewed by GIMI", "badge-paid") : badge("With GIMI", "badge-pending")}
      </p>
    </div>
    ${isAdmin && !l.reviewed ? `<div class="toolbar">
      <button class="btn btn-sm" data-action="review-lead" data-id="${l.id}">Mark reviewed</button>
    </div>` : ""}
  </div>

  <section class="block block-plain">
    <div class="kpi-row">
      ${kpi("network", "Expected value", money(l.expectedRevenue), "The partner's own estimate.")}
      ${kpi("network", "Stage", LEAD_STAGE[l.stage])}
      ${kpi("network", "Probability", l.probability)}
      ${kpi("network", "Expected close", l.expectedCloseDate ? date(l.expectedCloseDate) : "Not set")}
    </div>
  </section>

  <div class="two-col">
    <section class="block">
      <h2>Qualification</h2>
      <table><tbody>
        <tr><td style="border:0;padding:4px 14px 4px 0;color:var(--muted)">Have they met</td><td style="border:0;padding:4px 0">${esc(MET_STATUS[l.metStatus])}</td></tr>
        <tr><td style="border:0;padding:4px 14px 4px 0;color:var(--muted)">Documents sent</td><td style="border:0;padding:4px 0">${esc(DOCS_SENT[l.docsSent])}</td></tr>
        <tr><td style="border:0;padding:4px 14px 4px 0;color:var(--muted)">Products of interest</td><td style="border:0;padding:4px 0">${l.products.length ? l.products.map((p) => `<span class="chip">${esc(p)}</span>`).join("") : "—"}</td></tr>
      </tbody></table>
      <h4 style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin:16px 0 6px">Support asked for from GIMI</h4>
      <p style="font-size:13.5px">${esc(l.supportNeeded) || "Nothing recorded."}</p>
    </section>

    <section class="block">
      <div class="section-head">
        <h2>Documents from GIMI (${l.documents.length})</h2>
        ${isAdmin ? `<div class="toolbar">
          <button class="btn btn-ghost btn-sm" data-action="open-attach-lead-doc" data-id="${l.id}">+ Attach a document</button>
        </div>` : ""}
      </div>
      ${l.documents.length === 0
        ? `<div class="empty">${isAdmin
            ? "Nothing attached. Anything you attach here reaches the partner."
            : "GIMI has not attached anything for this lead yet."}</div>`
        : `<div class="table-scroll"><table>
            <thead><tr><th>Document</th><th>Added</th><th class="right">Actions</th></tr></thead>
            <tbody>${l.documents.map((d) => `
              <tr>
                <td>${esc(d.name)}<span class="sub">by ${esc(d.addedBy)}</span></td>
                <td class="nowrap">${date(d.when)}</td>
                <td><div class="row-actions">
                  <button class="btn btn-ghost btn-sm" data-action="download-lead-doc" data-id="${d.id}">Download</button>
                  ${isAdmin ? `<button class="btn btn-danger btn-sm" data-action="remove-lead-doc" data-lead="${l.id}" data-id="${d.id}">Remove</button>` : ""}
                </div></td>
              </tr>`).join("")}
            </tbody>
          </table></div>`}
    </section>
  </div>

  <section class="block">
    <h2>Comments (${l.comments.length})</h2>
    <label class="field">
      <textarea id="lc-text" placeholder="${isAdmin
        ? "Advice or context for the partner about this lead"
        : "A question for GIMI about this lead"}"></textarea>
    </label>
    <button class="btn btn-sm" data-action="add-lead-comment" data-id="${l.id}">Add comment</button>
    <div style="margin-top:14px">
      ${l.comments.length === 0
        ? `<div class="empty">No comments yet.</div>`
        : l.comments.map((c) => `
          <div style="border:1px solid var(--line);border-left:3px solid ${c.fromGimi ? "var(--teal)" : "var(--yellow)"};border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:8px">
            <p style="font-size:11.5px;color:var(--faint);margin-bottom:5px">
              ${esc(c.author)}${c.fromGimi ? " · GIMI" : " · partner"} · ${date(c.when)}
            </p>
            <p style="font-size:13.5px">${esc(c.text)}</p>
          </div>`).join("")}
    </div>
  </section>`;
}

const LEAD_HEAD = `<thead><tr>
  <th>Company</th><th>Partner</th><th>Stage</th><th>Probability</th><th>Met</th>
  <th>Docs sent</th><th class="num">Expected</th><th>Close</th>
  <th class="num">From GIMI</th><th class="right">Actions</th>
</tr></thead>`;

function adminLeads() {
  const toReview = DB.leads.filter((l) => !l.reviewed);

  return `
  <div class="page-head">
    <h1>Leads</h1>
    <p class="count">${DB.leads.length} leads shared by partners.</p>
  </div>

  <section class="block">
    <h2>Waiting to be reviewed (${toReview.length})</h2>
    ${toReview.length === 0
      ? `<div class="empty">Every lead has been reviewed.</div>`
      : `<div class="table-scroll"><table>${LEAD_HEAD}<tbody>${leadRows(toReview)}</tbody></table></div>`}
  </section>

  <section class="block">
    <h2>All leads</h2>
    <div class="table-scroll"><table>${LEAD_HEAD}<tbody>${leadRows(DB.leads)}</tbody></table></div>
  </section>`;
}

/** Shared by both lead tables so they cannot drift apart. */
function leadRows(rows) {
  return rows.map((l) => `
      <tr>
        <td><button class="btn-link" data-action="open-lead" data-id="${l.id}">${esc(l.company)}</button>
            <span class="sub">${esc(l.contact)}${l.documents.length ? ` · ${l.documents.length} document${l.documents.length > 1 ? "s" : ""}` : ""}${l.comments.length ? ` · ${l.comments.length} comment${l.comments.length > 1 ? "s" : ""}` : ""}</span></td>
        <td>${esc(partnerName(l.partnerId))}</td>
        <td>${esc(LEAD_STAGE[l.stage])}</td>
        <td>${esc(l.probability)}</td>
        <td>${esc(MET_STATUS[l.metStatus])}</td>
        <td>${esc(DOCS_SENT[l.docsSent])}</td>
        <td class="num">${money(l.expectedRevenue)}</td>
        <td class="nowrap">${date(l.expectedCloseDate)}</td>
        <td class="num">${l.documents.length || "—"}</td>
        <td><div class="row-actions">
          ${l.reviewed ? badge("Reviewed", "badge-neutral") : `<button class="btn btn-sm" data-action="review-lead" data-id="${l.id}">Mark reviewed</button>`}
          <button class="btn btn-ghost btn-sm" data-action="open-attach-lead-doc" data-id="${l.id}">Attach</button>
          <button class="btn btn-ghost btn-sm" data-action="open-lead" data-id="${l.id}">Open</button>
        </div></td>
      </tr>
      `).join("");
}

/* ----------------------------------------------------- admin: recognition */

/**
 * Recognition, arranged as the cycle it actually is rather than five unrelated
 * blocks. Reading down the page follows the process:
 *
 *   1. Collect nominations for the month being recognised
 *   2. Build the poll from those nominations, one click per option
 *   3. Partners vote; close it and the winner is recorded
 *   4. History and the ranking, last
 *
 * The month is chosen, not hardcoded. An award is decided in the month after the one
 * it recognises, so the selector names the month being recognised.
 */
function adminRecognition() {
  const month = S.awardMonth;
  const open = DB.polls.find((p) => p.status === "OPEN");
  const closed = DB.polls.filter((p) => p.status === "CLOSED");
  const nominations = DB.nominations.filter((n) => n.month === month && n.status === "PENDING");
  const winner = DB.winners.find((w) => w.month === month);

  const ranking = DB.partners
    .map((p) => {
      const issued = DB.invoices.filter((i) => i.partnerId === p.id && i.status !== "DRAFT" && inYearOf(i.issuedAt, S.year));
      return {
        p,
        invoiced: issued.reduce((n, i) => n + i.gimiAmount, 0),
        certified: DB.students.filter((s) => s.partnerId === p.id && s.status === "PASSED" && inYearOf(s.examDate, S.year)).length,
      };
    })
    .filter((r) => r.invoiced > 0 || r.certified > 0)
    .sort((a, b) => b.certified - a.certified || b.invoiced - a.invoiced);

  return `
  <div class="page-head section-head">
    <div>
      <h1>Recognition</h1>
      <p class="count">CTP of the Month, and the history behind it.</p>
    </div>
    <div class="toolbar">
      <label style="display:flex;align-items:center;gap:8px;font-size:13px">
        <span style="color:var(--muted)">Recognising</span>
        <select data-action="award-month" style="width:auto;padding:5px 8px">
          ${AWARD_MONTHS.map((m) => `<option value="${m}" ${month === m ? "selected" : ""}>${monthName(m)}</option>`).join("")}
        </select>
      </label>
    </div>
  </div>

  <div class="adder">
    <div class="adder-head">
      <h2>Add a nomination</h2>
      <button class="btn btn-sm" data-action="toggle-open" data-id="add-nom">
        ${S.open["add-nom"] ? "Cancel" : "+ Add a nomination"}
      </button>
    </div>
    ${S.open["add-nom"] ? `
      <div class="adder-body">
        <div class="grid-2">
          <label class="field"><span>Partner</span>
            <select id="an-partner">${DB.partners.filter((p) => p.status === "ACTIVE").map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></label>
          <label class="field"><span>Month being recognised</span>
            <select id="an-month">${AWARD_MONTHS.map((m) => `<option value="${m}" ${month === m ? "selected" : ""}>${monthName(m)}</option>`).join("")}</select></label>
        </div>
        <label class="field"><span>What they did</span>
          <textarea id="an-text" placeholder="Trained 40 people across three ministries, 38 certified."></textarea></label>
        <button class="btn btn-sm" data-action="add-nomination">Add nomination</button>
      </div>` : ""}
  </div>

  <section class="block">
    <h2>1 &middot; Nominations for ${esc(monthName(month))} (${nominations.length})</h2>
    ${nominations.length === 0
      ? `<div class="empty">No nominations for ${esc(monthName(month))} yet. Partners nominate each other, or add one above.</div>`
      : `<div class="table-scroll"><table>
        <thead><tr><th>Nominated</th><th>Nominated by</th><th>What they did</th><th class="right">Actions</th></tr></thead>
        <tbody>${nominations.map((n) => {
          const pool = open ? open.options : (S.pollDraft ? S.pollDraft.options : []);
          const alreadyAnOption = pool.some((o) => o.partnerId === n.partnerId);
          return `
          <tr>
            <td>${esc(partnerName(n.partnerId))}</td>
            <td>${n.byPartnerId === null
              ? `<span style="color:var(--faint)">GIMI</span>`
              : esc(partnerName(n.byPartnerId))}
              ${n.byPartnerId === n.partnerId ? `<span class="sub">nominated themselves</span>` : ""}</td>
            <td>${esc(n.text)}</td>
            <td><div class="row-actions">
              ${open
                ? (alreadyAnOption ? badge("On the poll", "badge-active") : `<span style="font-size:11.5px;color:var(--faint)">Poll already open</span>`)
                : alreadyAnOption
                  ? badge("Added", "badge-active")
                  : `<button class="btn btn-sm" data-action="nom-to-option" data-id="${n.id}">Use as poll option</button>`}
              <button class="btn btn-ghost btn-sm" data-action="dismiss-nom" data-id="${n.id}">Dismiss</button>
            </div></td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>`}
  </section>

  <section class="block">
    <h2>2 &middot; The poll</h2>
    ${open
      ? pollAdminCard(open)
      : winner
        ? `<div class="empty">${esc(monthName(month))} is decided: ${esc(partnerName(winner.partnerId))}.</div>`
        : S.pollDraft
          ? pollBuilder()
          : `<div class="empty">
               No poll running for ${esc(monthName(month))}.
               <div style="margin-top:12px"><button class="btn btn-sm" data-action="start-poll">Build the poll</button></div>
             </div>`}
  </section>

  <section class="block">
    <div class="section-head">
      <h2>3 &middot; Past winners (${DB.winners.length})</h2>
      <div class="toolbar">
        <button class="btn btn-ghost btn-sm" data-action="csv-winners" ${DB.winners.length === 0 ? "disabled" : ""}>Download CSV</button>
      </div>
    </div>
    ${DB.winners.length === 0 ? `<div class="empty">No winners recorded yet.</div>` : `
      <div class="table-scroll"><table>
        <thead><tr><th>Month recognised</th><th>Partner</th><th>Country</th></tr></thead>
        <tbody>${DB.winners.map((w) => `
          <tr>
            <td class="nowrap">${esc(monthName(w.month))}</td>
            <td>${esc(partnerName(w.partnerId))}</td>
            <td>${esc(partner(w.partnerId) ? partner(w.partnerId).country : "—")}</td>
          </tr>`).join("")}
        </tbody>
      </table></div>`}
  </section>

  ${closed.length ? `
    <section class="block">
      <h2>4 &middot; Closed polls</h2>
      ${closed.map((p) => `
        <div style="border:1px solid var(--line);border-radius:var(--radius-sm);padding:16px;margin-bottom:10px">
          <h4 style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:10px">
            ${esc(monthName(p.month))}
          </h4>
          ${pollResults(p)}
        </div>`).join("")}
    </section>` : ""}

  <section class="block">
    <div class="section-head">
      <h2>Partner ranking, ${esc(S.year)} &middot; admin only</h2>
      <div class="toolbar">
        <select data-action="set-year" style="width:auto;padding:6px 8px">
          ${YEARS.map((y) => `<option value="${y}" ${S.year === y ? "selected" : ""}>${y}</option>`).join("")}
        </select>
      </div>
    </div>
    ${ranking.length === 0 ? `<div class="empty">No activity recorded in ${esc(S.year)}.</div>` : `
      <div class="table-scroll"><table>
        <thead><tr><th>#</th><th>Partner</th><th>Country</th><th class="num">Certified</th><th class="num">GIMI invoiced</th></tr></thead>
        <tbody>${ranking.map((r, n) => `
          <tr>
            <td>${n + 1}</td>
            <td>${esc(r.p.name)}</td>
            <td>${esc(r.p.country)}</td>
            <td class="num">${r.certified}</td>
            <td class="num">${money(r.invoiced)}</td>
          </tr>`).join("")}
        </tbody>
      </table></div>`}
  </section>

  <section class="block">
    <h2>Setting</h2>
    <div class="toggle-row" style="margin-bottom:0">
      <div>
        <div class="lbl">Partner leaderboard</div>
        <span class="sub">When off, partners have no leaderboard nav item and the route does not exist. It ranks people certified and shows no money.</span>
      </div>
      <button class="btn ${DB.settings.leaderboardEnabled ? "btn-danger" : ""} btn-sm" data-action="toggle-leaderboard">
        ${DB.settings.leaderboardEnabled ? "Turn off" : "Turn on"}
      </button>
    </div>
  </section>`;
}

function pollAdminCard(poll) {
  const total = poll.options.reduce((n, o) => n + o.votes, 0);
  return `
  <div class="panel" style="padding:18px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div>
        <h2 style="font-size:14px;color:var(--teal-dark)">${esc(poll.question)}</h2>
        <p class="count">Recognising ${esc(monthName(poll.month))} · ${badge("Open", "badge-active")} · ${total} vote${total === 1 ? "" : "s"} cast</p>
      </div>
      <button class="btn btn-sm" data-action="close-poll" data-id="${poll.id}">Close and publish</button>
    </div>
    <p class="count" style="margin:14px 0 8px">
      Vote counts are hidden from partners while the poll is open. You see the total, not the split, until it closes.
    </p>
    ${poll.options.map((o) => `
      <div class="poll-option">
        <div style="flex:1">
          <div>${esc(o.label)}</div>
          <div class="who">Tagged to ${esc(partnerName(o.partnerId))}</div>
        </div>
      </div>`).join("")}
  </div>`;
}

function pollBuilder() {
  const d = S.pollDraft;
  return `
  <div class="adder" style="margin-bottom:0">
    <div class="adder-head">
      <h2>Building the poll for ${esc(monthName(d.month))}</h2>
      <button class="btn btn-ghost btn-sm" data-action="start-poll">Discard</button>
    </div>
    <div class="adder-body">
      <label class="field"><span>Question partners see</span>
        <input type="text" id="pd-q" data-action="poll-question" value="${esc(d.question)}"></label>

      <h4 style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin:16px 0 8px">
        Options (${d.options.length})
      </h4>
      ${d.options.length === 0
        ? `<div class="empty" style="padding:20px">
             Nothing yet. Use <strong>Use as poll option</strong> on a nomination above, or add one by hand below.
           </div>`
        : d.options.map((o, n) => `
        <div class="poll-option">
          <div style="flex:1">
            <textarea data-action="edit-option" data-id="${n}" style="min-height:52px">${esc(o.label)}</textarea>
            <div class="who">Tagged to ${esc(partnerName(o.partnerId))} · invisible to voters</div>
          </div>
          <button class="btn btn-danger btn-sm" data-action="drop-option" data-id="${n}">Remove</button>
        </div>`).join("")}

      <div class="grid-2" style="margin-top:14px">
        <label class="field"><span>Add another partner by hand</span>
          <select id="po-partner">${DB.partners.filter((p) => p.status === "ACTIVE").map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select>
          <span class="hint">Invisible to voters. It links the winner to a real partner.</span>
        </label>
        <label class="field"><span>Wording voters will see</span>
          <textarea id="po-label" placeholder="Partner X: trained 40 people across three countries."></textarea>
        </label>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" data-action="add-option">Add option</button>
        <button class="btn btn-sm" data-action="open-poll" ${d.options.length < 2 ? "disabled" : ""}>
          Open poll to partners
        </button>
        ${d.options.length < 2 ? `<span style="font-size:11.5px;color:var(--faint);align-self:center">A poll needs at least two options.</span>` : ""}
      </div>
    </div>
  </div>`;
}

function pollResults(poll) {
  const total = Math.max(1, poll.options.reduce((n, o) => n + o.votes, 0));
  const winner = [...poll.options].sort((a, b) => b.votes - a.votes)[0];
  return `
  ${poll.options.map((o) => `
    <div class="poll-result">
      <div class="label">${esc(o.label)}<span class="sub">${esc(partnerName(o.partnerId))}</span></div>
      <div class="bar ${o === winner ? "green" : ""}"><i style="width:${(o.votes / total) * 100}%"></i></div>
      <div style="width:64px" class="num">${o.votes} vote${o.votes === 1 ? "" : "s"}</div>
    </div>`).join("")}
  <p class="count" style="margin-top:8px">Winner: <strong>${esc(partnerName(winner.partnerId))}</strong></p>`;
}

/* ========================================================== partner shell */

function partnerTabs() {
  const tabs = [
    ["dashboard", "Dashboard"],
    ["enroll", "Students"],
    ["invoices", "Invoices"],
    ["leads", "Leads"],
    ["library", "Library"],
    ["community", "Community"],
  ];
  // Feature flag gates the whole route: when off there is no nav item at all.
  if (DB.settings.leaderboardEnabled) tabs.push(["leaderboard", "Leaderboard"]);
  tabs.push(["profile", "Profile"]);
  return tabs;
}

function partnerShell() {
  const tabs = partnerTabs();
  if (!tabs.some(([k]) => k === S.partnerTab)) S.partnerTab = "dashboard";

  const body = S.leadPage ? leadPage(S.leadPage) : {
    dashboard: partnerDashboard,
    enroll: partnerStudents,
    invoices: partnerInvoices,
    leads: partnerLeads,
    library: partnerLibrary,
    community: partnerCommunity,
    leaderboard: partnerLeaderboard,
    profile: partnerProfile,
  }[S.partnerTab]();

  return `
  <header class="app-header">
    <img src="gimi-logo-white.png" alt="GIMI Institute">
    <div class="who">
      <span>${esc(S.identity.email)}</span>
      <button data-action="signout">Sign out</button>
    </div>
  </header>
  <nav class="tabs" aria-label="Sections">
    <ul>${tabs.map(([k, label]) =>
      `<li><button data-action="partner-tab" data-tab="${k}" ${S.partnerTab === k ? 'aria-current="page"' : ""}>${label}</button></li>`,
    ).join("")}</ul>
  </nav>
  <main class="app-main">${noticeHtml()}${body}</main>
  ${modalHtml()}`;
}

const myId = () => S.identity.partnerId;
const myStudents = () => DB.students.filter((s) => s.partnerId === myId());
/* The partner query can never return a DRAFT. Filtered here, not in a component. */
const myInvoices = () => DB.invoices.filter((i) => i.partnerId === myId() && i.status !== "DRAFT");
const myLeads = () => DB.leads.filter((l) => l.partnerId === myId());
const mySubmissions = () => DB.submissions.filter((s) => s.partnerId === myId());

function partnerDashboard() {
  const me = partner(myId());
  const students = myStudents();
  const certified = students.filter((s) => s.status === "PASSED").length;
  const revenue = myInvoices().reduce((n, i) => n + i.partnerRevenue, 0);
  const target = me.expectedRevenue ?? 0;
  const openPoll = DB.polls.find((p) => p.status === "OPEN");
  const alreadyVoted = openPoll?.votedBy.includes(S.identity.email);
  const myNominations = DB.nominations.filter((n) => n.byPartnerId === myId());

  return `
  <div class="page-head">
    <h1>${esc(me.name)}</h1>
    <p class="count">Signed in as ${esc(S.identity.name)}.</p>
  </div>

  ${openPoll ? `
    <section class="block">
      <h2>CTP of the Month vote</h2>
      <div class="panel" style="padding:18px">
        <h2 style="font-size:14px;color:var(--teal-dark)">${esc(openPoll.question)}</h2>
        <p class="count" style="margin:4px 0 14px">
          Recognising ${esc(monthName(openPoll.month))}. One vote per account.
          ${alreadyVoted ? "Your organisation has voted." : "You have not voted yet."}
        </p>
        ${alreadyVoted ? `
          <div class="notice notice-ok">Vote recorded. Results are published when the poll closes.</div>
        ` : openPoll.options.map((o) => `
          <div class="poll-option">
            <div style="flex:1">${esc(o.label)}</div>
            <button class="btn btn-sm" data-action="vote" data-poll="${openPoll.id}" data-id="${o.id}"
              ${o.partnerId === myId() ? "disabled" : ""}>
              ${o.partnerId === myId() ? "That's you" : "Vote"}
            </button>
          </div>`).join("")}
        <p class="count">Partners are asked not to vote for themselves, and their own entry is not selectable.</p>
      </div>
    </section>` : ""}

  <section class="block block-plain">
    <div class="kpi-row">
      ${kpi("delivery", "Enrolled", students.length)}
      ${kpi("delivery", "Certified", certified)}
      ${kpi("delivery", "Pass rate", passRate(students))}
      ${kpi("network", "Certifications used", new Set(students.map((s) => s.cert)).size)}
    </div>
  </section>

  <section class="block">
    <h2>Progress</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>Measure</th><th class="num">Now</th><th class="num">Target</th><th style="width:35%">Progress</th></tr></thead>
      <tbody>
        <tr>
          <td>Your revenue</td>
          <td class="num">${money(revenue)}</td>
          <td class="num">${money(me.expectedRevenue)}</td>
          <td><div class="bar green"><i style="width:${target ? Math.min(100, (revenue / target) * 100) : 0}%"></i></div></td>
        </tr>
        <tr>
          <td>People certified</td>
          <td class="num">${certified}</td>
          <td class="num">25</td>
          <td><div class="bar"><i style="width:${Math.min(100, (certified / 25) * 100)}%"></i></div></td>
        </tr>
      </tbody>
    </table></div>
  </section>

  <section class="block">
    <h2>Nominations you submitted</h2>
    ${myNominations.length === 0 ? `<div class="empty">You have not nominated anyone this month.</div>` : `
      <div class="table-scroll"><table>
        <thead><tr><th>Month</th><th>Nominated</th><th>Why</th><th>Status</th></tr></thead>
        <tbody>${myNominations.map((n) => `<tr>
          <td class="nowrap">${esc(monthName(n.month))}</td>
          <td>${esc(partnerName(n.partnerId))}</td>
          <td>${esc(n.text)}</td>
          <td>${badge(n.status === "PENDING" ? "With GIMI" : n.status === "SELECTED" ? "Selected" : "Not selected", "badge-neutral")}</td>
        </tr>`).join("")}</tbody>
      </table></div>`}
  </section>`;
}

function partnerStudents() {
  const subs = mySubmissions();
  const students = myStudents();

  return `
  <div class="page-head">
    <h1>Students</h1>
    <p class="count">Showing ${students.length} of ${students.length} enrolled.</p>
  </div>

  <section class="block">
    <div class="adder">
      <div class="adder-head">
        <h2>Enroll students</h2>
        <button class="btn btn-sm" data-action="toggle-open" data-id="enroll">
          ${S.open.enroll ? "Cancel" : "+ Enroll students"}
        </button>
      </div>
      ${S.open.enroll ? stagingArea() : ""}
    </div>

    <h2>Submissions awaiting GIMI (${subs.filter((s) => s.status === "PENDING").length})</h2>
    ${subs.length === 0 ? `<div class="empty">Nothing submitted yet.</div>` : `
      <div class="table-scroll"><table>
        <thead><tr><th>File</th><th class="num">People</th><th>Sent</th><th>Status</th></tr></thead>
        <tbody>${subs.map((s) => `
          <tr>
            <td><button class="btn-link" data-action="toggle-open" data-id="psub-${s.id}">${esc(s.fileName)}</button></td>
            <td class="num">${s.roster.length}</td>
            <td class="nowrap">${date(s.submittedAt)}</td>
            <td>${badge(s.status === "PENDING" ? "With GIMI" : s.status === "PROCESSED" ? "Processed" : "Rejected", s.status === "PROCESSED" ? "badge-paid" : "badge-pending")}</td>
          </tr>
          ${S.open["psub-" + s.id] ? `
            <tr class="detail-row"><td colspan="4">
              <div class="table-scroll" style="background:var(--white)"><table>
                <thead><tr><th>Name</th><th>Email</th><th>Certification</th><th>Exam date</th></tr></thead>
                <tbody>${s.roster.map((r) => `<tr>
                  <td>${esc(r.first)} ${esc(r.last)}</td><td>${esc(r.email) || missing()}</td>
                  <td>${esc(r.cert)}</td><td class="nowrap">${date(r.examDate)}</td></tr>`).join("")}</tbody>
              </table></div>
            </td></tr>` : ""}`).join("")}
        </tbody>
      </table></div>`}
  </section>

  <section class="block">
    <h2>Progress</h2>
    ${students.length === 0 ? `<div class="empty">No students yet.</div>` : `
      <div class="table-scroll"><table>
        <thead><tr><th>Name</th><th>Certification</th><th>Exam date</th><th>Language</th><th>Status</th></tr></thead>
        <tbody>${students.map((s) => `<tr>
          <td>${esc(s.first)} ${esc(s.last)}<span class="sub">${esc(s.email)}</span></td>
          <td>${esc(s.cert)}</td><td class="nowrap">${date(s.examDate)}</td><td>${esc(s.lang)}</td>
          <td>${badge(STUDENT_STATUS[s.status], s.status === "PASSED" ? "badge-paid" : s.status === "FAILED" ? "badge-suspended" : "badge-neutral")}</td>
        </tr>`).join("")}</tbody>
      </table></div>`}
  </section>`;
}

/* The staging table: rows parse in, incomplete ones are flagged, and
   submission is blocked until the partner fixes them. Not GIMI's job. */
function stagingArea() {
  const bad = S.staging.filter(rowIncomplete).length;
  return `
  <div class="adder-body">
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
      <button class="btn btn-ghost btn-sm" data-action="fake-upload">Upload the GIMI template</button>
      <button class="btn btn-ghost btn-sm" data-action="add-blank-row">Add one person</button>
    </div>

    ${S.staging.length === 0 ? `<div class="empty">Upload a filled-in template, or add people one at a time.</div>` : `
      <div class="table-scroll" style="background:var(--white)"><table>
        <thead><tr><th>First</th><th>Last</th><th>Email</th><th>Certification</th><th>Exam date</th><th></th></tr></thead>
        <tbody>${S.staging.map((r, n) => `
          <tr ${rowIncomplete(r) ? 'style="background:rgba(222,142,61,.08)"' : ""}>
            <td><input type="text" value="${esc(r.first)}" data-stage="${n}:first"></td>
            <td><input type="text" value="${esc(r.last)}" data-stage="${n}:last"></td>
            <td><input type="text" value="${esc(r.email)}" data-stage="${n}:email"></td>
            <td><select data-stage="${n}:cert">
              <option value="">—</option>
              ${CERTIFICATIONS.map((c) => `<option ${r.cert === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
            </select></td>
            <td><input type="date" value="${esc(r.examDate)}" data-stage="${n}:examDate"></td>
            <td><button class="btn btn-danger btn-sm" data-action="drop-stage" data-id="${n}">Remove</button></td>
          </tr>`).join("")}
        </tbody>
      </table></div>

      <div style="display:flex;align-items:center;gap:12px;margin-top:14px;flex-wrap:wrap">
        <button class="btn btn-sm" data-action="submit-staging" ${bad > 0 ? "disabled" : ""}>
          Send ${S.staging.length} ${S.staging.length === 1 ? "person" : "people"} to GIMI
        </button>
        ${bad > 0
          ? `<span style="font-size:12px;color:var(--pink)">${bad} row${bad > 1 ? "s" : ""} incomplete. Fix them before sending.</span>`
          : `<span style="font-size:11.5px;color:var(--faint)">Every row has the fields GIMI requires.</span>`}
      </div>`}
  </div>`;
}

const PARTNER_INVOICE_HEAD = `<thead><tr>
  <th>Description</th><th class="num">People</th><th class="num">Your revenue</th>
  <th class="num">GIMI amount</th><th>Status</th><th>Due</th><th class="right">Actions</th>
</tr></thead>`;

/** Shared by both partner invoice tables so they cannot drift apart. */
function partnerInvoiceRows(rows) {
  return rows.map((i) => `
    <tr>
      <td>${esc(i.description)}</td>
      <td class="num">${i.studentCount}</td>
      <td class="num">${money(i.partnerRevenue)}</td>
      <td class="num">${money(i.gimiAmount)}</td>
      <td>${invoiceBadge(i.status)}${i.payment ? `<span class="sub">${esc(i.payment.reference)}</span>` : ""}</td>
      <td class="nowrap">${date(i.dueDate)}${i.status === "SENT" && i.dueDate < TODAY ? `<span class="sub" style="color:var(--pink);font-weight:700">Overdue</span>` : ""}</td>
      <td><div class="row-actions">
        ${i.pdf ? `<button class="btn btn-ghost btn-sm" data-action="download" data-id="${i.id}">Download invoice</button>` : ""}
        ${i.status === "SENT" ? `<button class="btn btn-sm" data-action="open-report" data-id="${i.id}">Report payment</button>` : ""}
      </div></td>
    </tr>`).join("");
}

function partnerInvoices() {
  const rows = myInvoices();
  const toPay = rows.filter((i) => i.status === "SENT");
  return `
  <div class="page-head">
    <h1>Invoices</h1>
    <p class="count">${rows.length} invoices from GIMI.</p>
  </div>

  <section class="block">
    <h2>Awaiting your payment (${toPay.length})</h2>
    ${toPay.length === 0
      ? `<div class="empty">Nothing to pay. Every invoice is either settled or with GIMI.</div>`
      : `<div class="table-scroll"><table>${PARTNER_INVOICE_HEAD}<tbody>${partnerInvoiceRows(toPay)}</tbody></table></div>`}
  </section>

  <section class="block">
    <h2>All invoices</h2>
    ${rows.length === 0
      ? `<div class="empty">No invoices yet.</div>`
      : `<div class="table-scroll"><table>${PARTNER_INVOICE_HEAD}<tbody>${partnerInvoiceRows(rows)}</tbody></table></div>`}
  </section>

  <section class="block" style="margin-top:24px">
    <h2>Where to pay</h2>
    <div class="panel" style="padding:16px">
      <table style="font-size:13px">
        <tbody>
          <tr><td style="border:0;padding:3px 12px 3px 0;color:var(--muted)">Bank</td><td style="border:0;padding:3px 0">Example Bank, Boston MA</td></tr>
          <tr><td style="border:0;padding:3px 12px 3px 0;color:var(--muted)">Account</td><td style="border:0;padding:3px 0">GIMI Institute Inc.</td></tr>
          <tr><td style="border:0;padding:3px 12px 3px 0;color:var(--muted)">SWIFT</td><td style="border:0;padding:3px 0">EXBKUS33</td></tr>
          <tr><td style="border:0;padding:3px 12px 3px 0;color:var(--muted)">Reference</td><td style="border:0;padding:3px 0">Your invoice number</td></tr>
        </tbody>
      </table>
    </div>
  </section>`;
}

function partnerLeads() {
  const rows = myLeads();
  const withGimi = rows.filter((l) => !l.reviewed);
  return `
  <div class="page-head">
    <h1>Leads</h1>
    <p class="count">Showing ${rows.length} of ${rows.length}.</p>
  </div>

  <div class="adder">
    <div class="adder-head">
      <h2>Add a lead</h2>
      <button class="btn btn-sm" data-action="toggle-open" data-id="add-lead">${S.open["add-lead"] ? "Cancel" : "+ Add a lead"}</button>
    </div>
    ${S.open["add-lead"] ? `
      <div class="adder-body">
        <div class="grid-2">
          <label class="field"><span>Company</span><input type="text" id="al-company"></label>
          <label class="field"><span>Contact name</span><input type="text" id="al-contact"></label>
          <label class="field"><span>Probability</span><select id="al-prob"><option>HIGH</option><option selected>MEDIUM</option><option>LOW</option></select></label>
          <label class="field"><span>Expected revenue</span><input type="text" id="al-rev" placeholder="50000"></label>
          <label class="field"><span>Have you met?</span><select id="al-met">${Object.entries(MET_STATUS).map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
          <label class="field"><span>Documents sent</span><select id="al-docs">${Object.entries(DOCS_SENT).map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
        </div>
        <label class="field"><span>What support do you need from GIMI?</span><textarea id="al-support"></textarea></label>
        <button class="btn btn-sm" data-action="add-lead">Share with GIMI</button>
      </div>` : ""}
  </div>

  <section class="block">
    <h2>With GIMI, not yet reviewed (${withGimi.length})</h2>
    ${withGimi.length === 0
      ? `<div class="empty">GIMI has looked at every lead you shared.</div>`
      : `<div class="table-scroll"><table>${MY_LEAD_HEAD}<tbody>${myLeadRows(withGimi)}</tbody></table></div>`}
  </section>

  <section class="block">
    <h2>All your leads</h2>
    ${rows.length === 0
      ? `<div class="empty">No leads shared yet.</div>`
      : `<div class="table-scroll"><table>${MY_LEAD_HEAD}<tbody>${myLeadRows(rows)}</tbody></table></div>`}
  </section>`;
}

const MY_LEAD_HEAD = `<thead><tr>
  <th>Company</th><th>Stage</th><th>Probability</th><th>Met</th>
  <th>Docs sent</th><th class="num">Expected</th>
  <th class="num">From GIMI</th><th>Status</th><th class="right"></th>
</tr></thead>`;

/** Shared by both partner lead tables so they cannot drift apart. */
function myLeadRows(rows) {
  return rows.map((l) => `
    <tr>
      <td><button class="btn-link" data-action="open-lead" data-id="${l.id}">${esc(l.company)}</button>
          <span class="sub">${esc(l.contact)}${l.documents.length ? ` · ${l.documents.length} document${l.documents.length > 1 ? "s" : ""} from GIMI` : ""}</span></td>
      <td>${esc(LEAD_STAGE[l.stage])}</td>
      <td>${esc(l.probability)}</td>
      <td>${esc(MET_STATUS[l.metStatus])}</td>
      <td>${esc(DOCS_SENT[l.docsSent])}</td>
      <td class="num">${money(l.expectedRevenue)}</td>
      <td class="num">${l.documents.length || "—"}</td>
      <td>${l.reviewed ? badge("Reviewed", "badge-paid") : badge("With GIMI", "badge-pending")}</td>
      <td><div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-action="open-lead" data-id="${l.id}">Open</button>
      </div></td>
    </tr>`).join("");
}

/**
 * The product catalogue, grouped as GIMI groups it, with each certification
 * expanding to the description, what is included, the skills, the career
 * outcomes and the published price.
 *
 * Every word here comes from GIMI_Product_Catalogue_V68.pptx. Nothing is
 * paraphrased, so a partner reads exactly what the catalogue says.
 */
function catalogueSection() {
  const groups = [...new Set(DB.catalogue.map((c) => c.group))];

  return `
  <section class="block">
    <h2>Certifications you can deliver (${DB.catalogue.length})</h2>
    <p class="count" style="margin-bottom:12px">
      From the GIMI product catalogue. Click a certification for the full description.
      Enrolment happens in the Students tab, not here.
    </p>
    ${groups.map((group) => {
      const rows = DB.catalogue.filter((c) => c.group === group);
      return `
      <h3 style="font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin:18px 0 8px">
        ${esc(group)} (${rows.length})
      </h3>
      <div class="table-scroll"><table>
        <thead><tr>
          <th>Certification</th><th>Code</th><th>For</th><th>Time</th>
          <th class="num">Certificate</th><th class="num">With training</th>
        </tr></thead>
        <tbody>${rows.map((c) => `
          <tr>
            <td><button class="btn-link" data-action="toggle-open" data-id="cat-${c.code}">${esc(c.name)}</button>
              ${c.tagline ? `<span class="sub">${esc(c.tagline)}</span>` : ""}</td>
            <td class="nowrap">${esc(c.code)}</td>
            <td>${esc(c.audience || "—")}</td>
            <td class="nowrap">${esc(c.time || "—")}</td>
            <td class="num nowrap">${esc(c.certPrice || "—")}</td>
            <td class="num nowrap">${esc(c.trainingPrice || "—")}</td>
          </tr>
          ${S.open["cat-" + c.code] ? catalogueDetail(c) : ""}`).join("")}
        </tbody>
      </table></div>`;
    }).join("")}
  </section>`;
}

function catalogueDetail(c) {
  const list = (label, items) =>
    items && items.length
      ? `<div>
           <h4 style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:6px">${label}</h4>
           <ul style="margin:0;padding-left:18px;font-size:13px">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
         </div>`
      : "";

  return `
  <tr class="detail-row"><td colspan="6">
    <p style="font-size:13.5px;max-width:78ch;margin-bottom:16px">${esc(c.description)}</p>
    <div class="two-col" style="margin-bottom:14px">
      ${list("What's included", c.included)}
      ${list("Skills you'll master", c.skills)}
    </div>
    <div class="two-col">
      ${list("Career outcomes", c.outcomes)}
      <div>
        <h4 style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Examination</h4>
        <table style="font-size:13px"><tbody>
          <tr><td style="border:0;padding:2px 12px 2px 0;color:var(--muted)">Format</td><td style="border:0;padding:2px 0">${esc(c.examFormat || "—")}</td></tr>
          <tr><td style="border:0;padding:2px 12px 2px 0;color:var(--muted)">Prerequisite</td><td style="border:0;padding:2px 0">${esc(c.prerequisite || "None")}</td></tr>
          <tr><td style="border:0;padding:2px 12px 2px 0;color:var(--muted)">Certificate</td><td style="border:0;padding:2px 0">${esc(c.certPrice || "—")}${c.certMode ? " · " + esc(c.certMode) : ""}</td></tr>
          <tr><td style="border:0;padding:2px 12px 2px 0;color:var(--muted)">With training</td><td style="border:0;padding:2px 0">${esc(c.trainingPrice || "—")}${c.trainingMode ? " · " + esc(c.trainingMode) : ""}</td></tr>
        </tbody></table>
      </div>
    </div>
  </td></tr>`;
}

function partnerLibrary() {
  return `
  <div class="page-head">
    <h1>Library</h1>
    <p class="count">The same for every partner.</p>
  </div>

  ${catalogueSection()}

  <section class="block">
    <h2>Documents (${DB.library.length})</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>Document</th><th>Type</th><th>Updated</th><th class="right">Actions</th></tr></thead>
      <tbody>${DB.library.map((d) => `
        <tr>
          <td>${esc(d.name)}</td><td>${esc(d.kind)}</td><td class="nowrap">${date(d.updated)}</td>
          <td><div class="row-actions"><button class="btn btn-ghost btn-sm" data-action="download-doc" data-id="${d.id}">Download</button></div></td>
        </tr>`).join("")}
      </tbody>
    </table></div>
  </section>
  <section class="block" style="margin-top:24px">
    <h2>Talk to GIMI</h2>
    <div class="panel" style="padding:16px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-sm" data-action="stub">Book a meeting with the team</button>
      <button class="btn btn-ghost btn-sm" data-action="stub">Open gimiinstitute.org</button>
    </div>
  </section>`;
}

function partnerCommunity() {
  const visible = DB.partners.filter((p) => p.visibleInDirectory && p.status === "ACTIVE");
  return `
  <div class="page-head">
    <h1>Community</h1>
    <p class="count">${visible.length} partners have opted into the directory.</p>
  </div>

  <section class="block">
    <h2>Partner directory</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>Partner</th><th>Country</th><th>Website</th></tr></thead>
      <tbody>${visible.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.country)}</td><td>${esc(p.website || "—")}</td></tr>`).join("")}</tbody>
    </table></div>
    <p class="count" style="margin-top:8px">Partners who opted out do not appear, for anyone.</p>
  </section>

  <section class="block">
    <h2>Forum</h2>
    ${DB.forum.map((f) => `
      <div class="panel" style="padding:14px;margin-bottom:8px">
        <p style="font-size:12px;color:var(--muted);margin-bottom:4px">${esc(f.author)} · ${esc(partnerName(f.partnerId))} · ${date(f.when)}</p>
        <p style="font-size:13.5px">${esc(f.text)}</p>
      </div>`).join("")}
    <div class="adder" style="margin-top:12px">
      <div class="adder-body">
        <label class="field"><span>Post to the forum</span><textarea id="fo-text"></textarea></label>
        <button class="btn btn-sm" data-action="add-post">Post</button>
      </div>
    </div>
  </section>`;
}

function partnerLeaderboard() {
  const rows = DB.partners
    .filter((p) => p.status === "ACTIVE")
    .map((p) => ({ p, certified: DB.students.filter((s) => s.partnerId === p.id && s.status === "PASSED").length }))
    .sort((a, b) => b.certified - a.certified);
  const max = Math.max(1, ...rows.map((r) => r.certified));

  return `
  <div class="page-head">
    <h1>Leaderboard</h1>
    <p class="count">Ranked by people certified. No money figures appear here, for anyone.</p>
  </div>
  <div class="table-scroll"><table>
    <thead><tr><th>#</th><th>Partner</th><th class="num">Certified</th><th style="width:35%"></th></tr></thead>
    <tbody>${rows.map((r, n) => `
      <tr ${r.p.id === myId() ? 'style="background:rgba(0,133,142,.06)"' : ""}>
        <td>${n + 1}</td>
        <td>${esc(r.p.name)}${r.p.id === myId() ? ` <span class="chip">You</span>` : ""}</td>
        <td class="num">${r.certified}</td>
        <td><div class="bar"><i style="width:${(r.certified / max) * 100}%"></i></div></td>
      </tr>`).join("")}
    </tbody>
  </table></div>`;
}

function partnerProfile() {
  const me = partner(myId());
  return `
  <div class="page-head">
    <h1>Profile</h1>
    <p class="count">Your organisation's details, as GIMI sees them.</p>
  </div>

  <section class="block">
    <h2>Your organisation</h2>
    <div class="grid-2" style="max-width:720px">
      <label class="field"><span>Company name</span><input type="text" value="${esc(me.name)}"></label>
      <label class="field"><span>Country</span><input type="text" value="${esc(me.country)}"></label>
      <label class="field"><span>Website</span><input type="text" value="${esc(me.website)}"></label>
      <label class="field"><span>Phone</span><input type="text" value="${esc(me.phone)}"></label>
      <label class="field"><span>Annual revenue target</span>
        <input type="text" value="${me.expectedRevenue ? Math.round(me.expectedRevenue / 100) : ""}" placeholder="120000">
        <span class="hint">Your own target. GIMI records it for context only.</span></label>
    </div>
    <button class="btn btn-sm" data-action="stub">Save changes</button>
  </section>

  <section class="block">
    <h2>Partner directory</h2>
    <div class="toggle-row" style="margin-bottom:0">
      <div>
        <div class="lbl">Show us in the partner directory</div>
        <span class="sub">Other partners can see your name, country and website. Nothing else.</span>
      </div>
      <button class="btn ${me.visibleInDirectory ? "btn-danger" : ""} btn-sm" data-action="toggle-directory">
        ${me.visibleInDirectory ? "Turn off" : "Turn on"}
      </button>
    </div>
  </section>

  <section class="block">
    <div class="section-head">
      <h2>Logins on this account (${me.users.length})</h2>
      <div class="toolbar">
        <button class="btn btn-ghost btn-sm" data-action="stub">+ Add another login</button>
      </div>
    </div>
    <div class="table-scroll"><table>
      <thead><tr><th>Name</th><th>Email</th><th>Last signed in</th></tr></thead>
      <tbody>${me.users.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td class="nowrap">${date(u.lastLogin)}</td></tr>`).join("")}</tbody>
    </table></div>
  </section>`;
}

/* ---------------------------------------------------------------- modal */

function modalHtml() {
  if (!S.modal) return "";

  // Rebuilt on every keystroke, so it is described rather than stored as HTML.
  const modal = S.modal.kind === "columns" ? columnsModal() : S.modal;

  return `
  <div class="modal-backdrop" data-action="close-modal">
    <div class="modal" data-stop="1">
      <div class="modal-head">
        <h2>${esc(modal.title)}</h2>
        <button class="close-x" data-action="close-modal">&times;</button>
      </div>
      <div class="modal-body">${modal.body}</div>
      <div class="modal-foot">${modal.foot ?? `<button class="btn btn-ghost btn-sm" data-action="close-modal">Close</button>`}</div>
    </div>
  </div>`;
}

/**
 * Add, rename and remove the columns on the Partners table. These columns and
 * everything written in them are admin-only and never reach a partner-facing screen.
 */
function columnsModal() {
  return {
    title: "Manage columns",
    body: `
      ${DB.customColumns.map((c) => {
        const filled = DB.partners.filter((p) => p.notes[c.id]).length;
        return `
        <div style="display:flex;align-items:flex-end;gap:8px;margin-bottom:12px">
          <label class="field" style="flex:1;margin:0">
            <span>Column ${c.position}${filled ? ` · ${filled} filled in` : ""}</span>
            <input type="text" value="${esc(c.name)}" data-action="rename-column" data-id="${c.id}">
          </label>
          <button class="btn btn-danger btn-sm" data-action="remove-column" data-id="${c.id}">Remove</button>
        </div>`;
      }).join("")}

      <div style="border-top:1px solid var(--line-soft);margin-top:6px;padding-top:16px">
        <label class="field">
          <span>Add a column</span>
          <input type="text" id="nc-name" placeholder="Renewal date">
        </label>
        <button class="btn btn-sm" data-action="add-column">Add column</button>
      </div>`,
  };
}

/* ============================================================== actions */

/**
 * Downloads a table as CSV, built in the browser. No server is involved.
 *
 * Every field is quoted and internal quotes doubled, so a company name containing
 * a comma cannot shift the columns. That is the whole reason this is a function
 * rather than rows.join(",").
 */
function downloadCsv(filename, headers, rows) {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

  // A BOM, so Excel opens UTF-8 correctly instead of mangling accented names.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** The figures behind "GIMI revenue by partner", for the selected year. */
function revenueByPartnerRows() {
  const invoices = invoicesInYear();
  return DB.partners
    .map((p) => {
      const issued = invoices.filter((i) => i.partnerId === p.id);
      const invoiced = issued.reduce((n, i) => n + i.gimiAmount, 0);
      const received = issued.filter((i) => i.status === "PAID").reduce((n, i) => n + i.gimiAmount, 0);
      return { p, certificates: issued.reduce((n, i) => n + i.studentCount, 0), invoiced, received };
    })
    .filter((r) => r.invoiced > 0)
    .sort((a, b) => b.invoiced - a.invoiced);
}

const val = (id) => ($("#" + id)?.value ?? "").trim();
const centsFrom = (text) => {
  const cleaned = text.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
};

const ACTIONS = {
  /* -------------------------------------------------------- sign in/out */
  "signin-admin"() {
    S.identity = IDENTITIES.admin; S.screen = "admin"; S.adminTab = "overview";
    S.notice = null; S.open = {};
  },
  "signin-partner"() {
    S.identity = IDENTITIES.partner; S.screen = "partner"; S.partnerTab = "dashboard";
    S.notice = null; S.open = {};
  },
  signout() { S.identity = null; S.screen = "signin"; S.notice = null; S.open = {}; },
  "goto-signin"() { S.screen = "signin"; S.notice = null; },

  /* ------------------------------------------------------------- navigation */
  "admin-tab"(el) { S.adminTab = el.dataset.tab; S.notice = null; },
  "set-year"(el) { S.year = el.value; },

  "csv-revenue"() {
    const rows = revenueByPartnerRows();
    if (rows.length === 0) return notice("bad", `Nothing to export for ${S.year}.`);
    downloadCsv(
      `gimi-revenue-by-partner-${S.year}.csv`,
      ["Partner", "Country", "Region", "Certificates", "GIMI invoiced", "Received", "Outstanding"],
      rows.map((r) => [
        r.p.name, r.p.country, r.p.region, r.certificates,
        (r.invoiced / 100).toFixed(2), (r.received / 100).toFixed(2),
        ((r.invoiced - r.received) / 100).toFixed(2),
      ]),
    );
    notice("ok", `Exported ${rows.length} partners for ${S.year}.`);
  },

  "partner-search"(el) { S.partnerSearch = el.value; S.focus = "partner-search"; },
  "partner-status"(el) { S.partnerStatus = el.value; },
  "partner-region"(el) { S.partnerRegion = el.value; },
  "clear-partner-filters"() {
    S.partnerSearch = ""; S.partnerStatus = "ALL"; S.partnerRegion = "ALL";
  },

  "csv-partners"() {
    const rows = filteredPartners();
    if (rows.length === 0) return notice("bad", "Nothing to export with these filters.");
    const cols = DB.customColumns;
    downloadCsv(
      "gimi-partners.csv",
      ["Partner", "Status", "Country", "Region", "Type", "Logins", "Joined", ...cols.map((c) => c.name)],
      rows.map((p) => [
        p.name,
        PARTNER_STATUS[p.status][0],
        p.country,
        p.region,
        p.partnerType,
        p.users.map((u) => u.email).join("; "),
        p.createdAt,
        ...cols.map((c) => p.notes[c.id] || ""),
      ]),
    );
    notice("ok", `Exported ${rows.length} partners.`);
  },

  "csv-certifications"() {
    const students = studentsInYear();
    if (students.length === 0) return notice("bad", `Nothing to export for ${S.year}.`);
    const byCert = {};
    students.forEach((s) => { byCert[s.cert] = (byCert[s.cert] ?? 0) + 1; });
    const rows = Object.entries(byCert).sort((a, b) => b[1] - a[1]);
    downloadCsv(
      `gimi-certifications-${S.year}.csv`,
      ["Certification", "Students", "Share of all students"],
      rows.map(([cert, n]) => [cert, n, Math.round((n / students.length) * 100) + "%"]),
    );
    notice("ok", `Exported ${rows.length} certifications for ${S.year}.`);
  },
  "partner-tab"(el) { S.partnerTab = el.dataset.tab; S.notice = null; },
  "toggle-open"(el) { S.open[el.dataset.id] = !S.open[el.dataset.id]; },
  "close-modal"() { S.modal = null; },
  stub() { notice("info", "Not wired up in the prototype."); },
  download(el) {
    const i = DB.invoices.find((x) => x.id === el.dataset.id);
    const file = ATTACHMENTS.get(i.id);
    if (!file) {
      // Seeded invoices carry a filename but no real file behind it.
      return notice("info", `${i.pdf} is a placeholder in this prototype. Attach a real file on a new invoice to see it download.`);
    }
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notice("ok", `Downloaded ${file.name}.`);
  },
  "download-doc"(el) {
    notice("info", `${DB.library.find((d) => d.id === el.dataset.id).name} would download here.`);
  },

  /* ------------------------------------------------------ partners: invite */
  "add-partner"() {
    const name = val("ap-name");
    const email = val("ap-email").toLowerCase();
    if (name.length < 2) return notice("bad", "Give the company a name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return notice("bad", "That is not a valid email address.");
    if (DB.partners.some((p) => p.users.some((u) => u.email === email)))
      return notice("bad", "That email already has an account. Add them to the existing partner instead.");

    const id = "p" + (DB.partners.length + 1) + Date.now().toString().slice(-3);
    DB.partners.push({
      id, name, country: "", status: "INVITED", website: "", linkedin: "", phone: "",
      expectedRevenue: null, visibleInDirectory: false,
      createdAt: "2026-07-29", approvedAt: null, users: [], notes: {},
    });
    DB.invites.push({ id: "i" + Date.now(), partnerId: id, email, expiresAt: "2026-08-05", sentAt: "2026-07-29" });

    S.open["add-partner"] = false;
    showInviteEmail(id, email, name);
  },

  "resend-invite"(el) {
    const p = partner(el.dataset.id);
    const invite = DB.invites.find((i) => i.partnerId === p.id);
    notice("ok", `New invitation sent to ${invite.email}. The previous link no longer works.`);
    showInviteEmail(p.id, invite.email, p.name);
  },

  "open-invite"(el) {
    S.modal = null;
    S.onboardingPartnerId = el.dataset.id;
    S.screen = "onboarding";
    S.notice = null;
  },

  "onboard-submit"() {
    const p = partner(S.onboardingPartnerId);
    const name = val("ob-name"), company = val("ob-company"), country = val("ob-country");
    const p1 = val("ob-p1"), p2 = val("ob-p2");
    if (company.length < 2) return notice("bad", "Company name is too short.");
    if (country.length < 2) return notice("bad", "Please give your country.");
    if (name.length < 2) return notice("bad", "Please give your full name.");
    if (p1.length < 12) return notice("bad", "Use a password of at least 12 characters.");
    if (p1 !== p2) return notice("bad", "The two passwords do not match.");

    let target = null;
    if (val("ob-target")) {
      target = centsFrom(val("ob-target"));
      if (target === null) return notice("bad", "Annual target should be a number, for example 120000.");
    }

    const invite = DB.invites.find((i) => i.partnerId === p.id);
    p.name = company; p.country = country;
    p.website = val("ob-website"); p.linkedin = val("ob-linkedin"); p.phone = val("ob-phone");
    p.expectedRevenue = target;
    p.users.push({ name, email: invite.email, lastLogin: null });

    // Completing the details is what makes them a partner. There is nothing to
    // approve afterwards: GIMI already decided by sending the invitation.
    p.status = "ACTIVE";
    p.approvedAt = "2026-07-29";

    // The invitation is spent, so the link stops working.
    DB.invites = DB.invites.filter((i) => i.partnerId !== p.id);

    S.screen = "done";
    S.notice = null;
  },

  suspend(el) {
    const p = partner(el.dataset.id);
    p.status = "SUSPENDED";
    notice("ok", `${p.name} suspended. Their history is untouched.`);
  },
  reactivate(el) {
    const p = partner(el.dataset.id);
    p.status = "ACTIVE";
    notice("ok", `${p.name} reactivated.`);
  },
  /* -------------------------------------------------------- managed columns */
  "manage-columns"() { S.modal = { kind: "columns" }; },

  "rename-column"(el) {
    const col = DB.customColumns.find((c) => String(c.id) === el.dataset.id);
    const name = el.value.trim();
    if (!name) return notice("bad", "A column needs a name.");
    col.name = name;
  },

  "add-column"() {
    const name = val("nc-name");
    if (name.length < 2) return notice("bad", "Give the column a name.");
    if (DB.customColumns.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      return notice("bad", "There is already a column with that name.");
    }
    DB.customColumns.push({
      id: DB.nextColumnId++,
      name,
      position: DB.customColumns.length + 1,
    });
    notice("ok", `Added "${name}".`);
  },

  "remove-column"(el) {
    const id = Number(el.dataset.id);
    const col = DB.customColumns.find((c) => c.id === id);
    // Removing a column deletes what everyone wrote in it, so say so before doing it.
    const filled = DB.partners.filter((p) => p.notes[id]).length;
    S.modal = {
      title: `Remove "${col.name}"?`,
      body: `<p style="font-size:13.5px">${filled === 0
        ? "Nothing has been written in this column."
        : `<strong>${filled} partner${filled === 1 ? "" : "s"}</strong> ${filled === 1 ? "has" : "have"} something written in this column. Removing it deletes that too.`}</p>`,
      foot: `<button class="btn btn-ghost btn-sm" data-action="close-modal">Cancel</button>
             <button class="btn btn-danger btn-sm" data-action="remove-column-confirm" data-id="${id}">Remove the column</button>`,
    };
  },

  "remove-column-confirm"(el) {
    const id = Number(el.dataset.id);
    const col = DB.customColumns.find((c) => c.id === id);
    DB.customColumns = DB.customColumns.filter((c) => c.id !== id);
    DB.customColumns.forEach((c, n) => { c.position = n + 1; });
    DB.partners.forEach((p) => { delete p.notes[id]; });
    S.modal = null;
    notice("ok", `Removed "${col.name}".`);
  },

  /* ------------------------------------------------------- the partner page */
  "open-partner"(el) { S.partnerPage = el.dataset.id; S.notice = null; },
  "close-partner"() { S.partnerPage = null; S.notice = null; },

  "add-partner-comment"() {
    const text = val("pc-text");
    if (text.length < 2) return notice("bad", "Write something first.");
    const p = partner(S.partnerPage);
    p.comments.unshift({ when: "2026-07-30", author: S.identity.name, text });
    notice("ok", "Comment added. Internal only.");
  },

  /* ------------------------------------------------- students: submissions */
  "open-submission"(el) { S.submissionPage = el.dataset.id; S.notice = null; },
  "close-submission"() { S.submissionPage = null; S.notice = null; },

  "student-search"(el) { S.studentSearch = el.value; S.focus = "student-search"; },
  "student-partner"(el) { S.studentPartner = el.value; },
  "student-cert"(el) { S.studentCert = el.value; },
  "student-status"(el) { S.studentStatus = el.value; },
  "student-year"(el) { S.studentYear = el.value; },
  "clear-student-filters"() {
    S.studentSearch = ""; S.studentPartner = "ALL"; S.studentCert = "ALL";
    S.studentStatus = "ALL"; S.studentYear = "ALL";
  },

  "csv-students"() {
    const rows = filteredStudents();
    if (rows.length === 0) return notice("bad", "Nothing to export with these filters.");
    downloadCsv(
      "gimi-students.csv",
      ["First name", "Last name", "Email", "Partner", "Country", "Certification", "Exam date", "Language", "Format", "Result", "Result set by", "Result set on"],
      rows.map((s) => [
        s.first, s.last, s.email, partnerName(s.partnerId), s.country, s.cert,
        s.examDate, s.lang,
        EXAM_FORMATS.find((f) => f.value === s.format)?.label ?? "",
        STUDENT_STATUS[s.status], s.resultSetBy ?? "", s.resultSetOn ?? "",
      ]),
    );
    notice("ok", `Exported ${rows.length} students.`);
  },

  "open-reject-sub"(el) {
    const sub = DB.submissions.find((s) => s.id === el.dataset.id);
    S.modal = {
      title: `Reject ${sub.fileName}?`,
      body: `
        <label class="field">
          <span>Why, in the partner's words</span>
          <textarea id="rs-reason" placeholder="Three rows are missing an exam date, and two email addresses bounce."></textarea>
          <span class="hint">${esc(partnerName(sub.partnerId))} sees exactly this, so write it for them.</span>
        </label>`,
      foot: `<button class="btn btn-ghost btn-sm" data-action="close-modal">Cancel</button>
             <button class="btn btn-danger btn-sm" data-action="reject-sub" data-id="${sub.id}">Reject and tell them</button>`,
    };
  },

  "confirm-sub"(el) {
    const sub = DB.submissions.find((s) => s.id === el.dataset.id);
    if (submissionBlocked(sub)) return notice("bad", "Some rows are missing required fields.");
    sub.status = "PROCESSED";
    sub.roster.forEach((r, n) => {
      DB.students.push({
        id: "s" + Date.now() + n, partnerId: sub.partnerId,
        first: r.first, last: r.last, email: r.email, city: "", country: "",
        company: r.company, cert: r.cert, examDate: r.examDate,
        lang: r.lang, format: r.format, status: "ENROLLED",
      });
    });
    // Same step raises a draft invoice. studentCount comes from the roster length.
    DB.invoices.push({
      id: "inv" + Date.now(), partnerId: sub.partnerId,
      description: `From ${sub.fileName}`, studentCount: sub.roster.length,
      partnerRevenue: 0, gimiAmount: 0, status: "DRAFT",
      issuedAt: null, dueDate: "2026-09-30", pdf: null, qbRef: null, payment: null,
    });
    S.submissionPage = null;
    notice("ok", `${sub.roster.length} students enrolled and a draft invoice raised. The partner cannot see the draft.`);
  },
  "reject-sub"(el) {
    const sub = DB.submissions.find((s) => s.id === el.dataset.id);
    const reason = val("rs-reason");
    if (reason.length < 5) return notice("bad", "Give the partner a reason. They only see what you write here.");
    sub.status = "REJECTED";
    sub.rejectedReason = reason;
    S.modal = null;
    S.submissionPage = null;
    notice("ok", `${sub.fileName} rejected. ${partnerName(sub.partnerId)} has been told why.`);
  },
  "set-result"(el) {
    const student = DB.students.find((x) => x.id === el.dataset.id);
    student.status = el.value;
    // Who changed a result and when. Marking somebody failed is consequential and
    // was previously untraceable.
    student.resultSetBy = S.identity.name;
    student.resultSetOn = TODAY;
    notice("ok", `${student.first} ${student.last} marked ${STUDENT_STATUS[el.value].toLowerCase()}.`);
  },

  /* ------------------------------------------------------------- invoices */
  "create-invoice"() {
    const rev = centsFrom(val("ni-rev")), gimi = centsFrom(val("ni-gimi"));
    if (!val("ni-desc")) return notice("bad", "Give the invoice a description.");
    if (rev === null || gimi === null) return notice("bad", "Both figures must be numbers. They are unrelated to each other.");

    const chosen = $("#ni-file")?.files?.[0] ?? null;
    if (!chosen) return notice("bad", "Attach the invoice PDF. The partner needs a file to download.");

    const id = "inv" + Date.now();
    // The real file is kept in memory so the partner downloads the actual document
    // rather than a filename. It does not survive a refresh; nothing here does.
    ATTACHMENTS.set(id, chosen);

    DB.invoices.push({
      id, partnerId: val("ni-partner"), description: val("ni-desc"),
      certification: val("ni-cert"),
      studentCount: Number(val("ni-count")) || 1, partnerRevenue: rev, gimiAmount: gimi,
      status: "DRAFT", issuedAt: null, dueDate: val("ni-due"),
      pdf: chosen.name, qbRef: val("ni-qb") || null, payment: null,
    });
    S.open["add-invoice"] = false;
    notice("ok", `Draft created with ${chosen.name} attached. Invisible to the partner until you send it.`);
  },
  "open-send"(el) {
    const i = DB.invoices.find((x) => x.id === el.dataset.id);
    const attached = ATTACHMENTS.get(i.id);
    S.modal = {
      title: "Send to partner",
      body: `
        <label class="field">
          <span>Attached invoice</span>
          ${i.pdf
            ? `<span style="font-size:13px">${esc(i.pdf)}${attached ? ` · ${Math.max(1, Math.round(attached.size / 1024))} KB` : " · placeholder, no file"}</span>`
            : `<input type="file" id="sd-file" accept="application/pdf,image/*">`}
        </label>
        <div class="grid-2">
          <label class="field"><span>Partner revenue</span><input type="text" id="sd-rev" value="${i.partnerRevenue ? Math.round(i.partnerRevenue / 100) : ""}"></label>
          <label class="field"><span>GIMI amount</span><input type="text" id="sd-gimi" value="${i.gimiAmount ? Math.round(i.gimiAmount / 100) : ""}"></label>
        </div>
        <label class="field"><span>QuickBooks reference <span class="optional">(optional)</span></span>
          <input type="text" id="sd-qb" value="${esc(i.qbRef || "")}"></label>`,
      foot: `<button class="btn btn-ghost btn-sm" data-action="close-modal">Cancel</button>
             <button class="btn btn-sm" data-action="send-invoice" data-id="${i.id}">Send to partner</button>`,
    };
  },
  "send-invoice"(el) {
    const i = DB.invoices.find((x) => x.id === el.dataset.id);
    const rev = centsFrom(val("sd-rev")), gimi = centsFrom(val("sd-gimi"));

    // A late attachment, for a draft raised by confirming a submission rather than
    // through the New invoice form.
    const late = $("#sd-file")?.files?.[0] ?? null;
    if (late) { ATTACHMENTS.set(i.id, late); i.pdf = late.name; }

    if (!i.pdf) return notice("bad", "A draft cannot be sent without the invoice attached.");
    if (gimi === null || gimi === 0) return notice("bad", "A draft cannot be sent without a GIMI amount.");
    if (rev === null) return notice("bad", "Partner revenue must be a number.");

    i.qbRef = val("sd-qb") || null;
    i.partnerRevenue = rev; i.gimiAmount = gimi;
    i.status = "SENT"; i.issuedAt = "2026-07-29";
    S.modal = null;
    notice("ok", `Sent. ${partnerName(i.partnerId)} is notified by email and can now download ${i.pdf}.`);
  },
  "open-report"(el) {
    const i = DB.invoices.find((x) => x.id === el.dataset.id);
    S.modal = {
      title: "Report a payment",
      body: `
        <p class="count" style="margin-bottom:14px">Tell GIMI you have paid. They confirm once the funds arrive.</p>
        <label class="field"><span>Bank reference</span><input type="text" id="rp-ref" placeholder="TRF-00000"></label>
        <div class="grid-2">
          <label class="field"><span>Date paid</span><input type="date" id="rp-date" value="2026-07-29"></label>
          <label class="field"><span>Method</span><select id="rp-method"><option>Bank transfer</option><option>Card</option><option>Cheque</option></select></label>
        </div>
        <label class="field"><span>Note <span class="optional">(optional)</span></span><textarea id="rp-note"></textarea></label>`,
      foot: `<button class="btn btn-ghost btn-sm" data-action="close-modal">Cancel</button>
             <button class="btn btn-sm" data-action="report-payment" data-id="${i.id}">Report payment</button>`,
    };
  },
  "report-payment"(el) {
    const i = DB.invoices.find((x) => x.id === el.dataset.id);
    if (!val("rp-ref")) return notice("bad", "Please give the bank reference.");
    i.payment = { reference: val("rp-ref"), paidOn: val("rp-date"), method: val("rp-method") };
    i.status = "PAYMENT_REPORTED";
    S.modal = null;
    notice("ok", "Reported. GIMI is notified by email and will confirm when the funds arrive.");
  },
  "confirm-payment"(el) {
    const i = DB.invoices.find((x) => x.id === el.dataset.id);
    i.status = "PAID";
    notice("ok", `${money(i.gimiAmount)} confirmed received. The invoice is now locked.`);
  },
  "reject-payment"(el) {
    const i = DB.invoices.find((x) => x.id === el.dataset.id);
    i.status = "SENT"; i.payment = null; // Clears the payment details.
    notice("ok", "Marked as not received. Back to sent, and the payment details are cleared.");
  },

  /* ---------------------------------------------------------------- leads */
  "review-lead"(el) {
    const l = DB.leads.find((x) => x.id === el.dataset.id);
    l.reviewed = true;
    notice("ok", `${l.company} marked reviewed.`);
  },

  /* ---------------------------------------------------------- the lead page */
  "open-lead"(el) { S.leadPage = el.dataset.id; S.notice = null; },
  "close-lead"() { S.leadPage = null; S.notice = null; },

  "add-lead-comment"(el) {
    const l = DB.leads.find((x) => x.id === el.dataset.id);
    const text = val("lc-text");
    if (text.length < 2) return notice("bad", "Write something first.");
    const fromGimi = S.identity.kind === "ADMIN";
    l.comments.unshift({ when: TODAY, author: S.identity.name, fromGimi, text });
    notice("ok", fromGimi
      ? `Comment added. ${partnerName(l.partnerId)} can read it on their own lead.`
      : "Comment added. GIMI can see it.");
  },

  "open-attach-lead-doc"(el) {
    S.modal = {
      title: "Attach a document",
      body: `
        <label class="field">
          <span>File</span>
          <input type="file" id="ld-file">
          <span class="hint">The partner downloads this exact file to use with their client.</span>
        </label>`,
      foot: `<button class="btn btn-ghost btn-sm" data-action="close-modal">Cancel</button>
             <button class="btn btn-sm" data-action="attach-lead-doc" data-id="${el.dataset.id}">Attach</button>`,
    };
  },

  "attach-lead-doc"(el) {
    const l = DB.leads.find((x) => x.id === el.dataset.id);
    const file = $("#ld-file")?.files?.[0] ?? null;
    if (!file) return notice("bad", "Choose a file first.");
    const docId = "ld" + Date.now();
    LEAD_FILES.set(docId, file);
    l.documents.push({ id: docId, name: file.name, addedBy: S.identity.name, when: TODAY });
    S.modal = null;
    notice("ok", `${file.name} attached. ${partnerName(l.partnerId)} can download it now.`);
  },

  "download-lead-doc"(el) {
    const file = LEAD_FILES.get(el.dataset.id);
    if (!file) {
      const doc = DB.leads.flatMap((l) => l.documents).find((d) => d.id === el.dataset.id);
      return notice("info", `${doc.name} is a placeholder in this prototype. Attach a real file to see it download.`);
    }
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url; link.download = file.name;
    document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
    notice("ok", `Downloaded ${file.name}.`);
  },

  "remove-lead-doc"(el) {
    const l = DB.leads.find((x) => x.id === el.dataset.lead);
    const doc = l.documents.find((d) => d.id === el.dataset.id);
    l.documents = l.documents.filter((d) => d.id !== el.dataset.id);
    LEAD_FILES.delete(el.dataset.id);
    notice("ok", `Removed ${doc.name}. The partner can no longer download it.`);
  },
  "add-lead"() {
    if (!val("al-company")) return notice("bad", "Give the company a name.");
    const rev = centsFrom(val("al-rev") || "0");
    DB.leads.push({
      id: "l" + Date.now(), partnerId: myId(), company: val("al-company"),
      contact: val("al-contact"), website: "", stage: "NEW",
      probability: val("al-prob"), metStatus: val("al-met"), docsSent: val("al-docs"),
      products: [], expectedRevenue: rev ?? 0, expectedCloseDate: null,
      supportNeeded: val("al-support"), reviewed: false,
    });
    S.open["add-lead"] = false;
    notice("ok", "Shared with GIMI. They will come back to you with support.");
  },

  /* --------------------------------------------------------- enrolment */
  "fake-upload"() {
    S.staging = [
      { first: "Imane", last: "Saidi", email: "imane@example.ma", cert: CERTIFICATIONS[0], examDate: "2026-10-08", lang: "English", format: "ONSITE_PROCTORED", company: "OCP" },
      { first: "Younes", last: "Ait", email: "younes@example.ma", cert: CERTIFICATIONS[1], examDate: "2026-10-08", lang: "English", format: "ONSITE_PROCTORED", company: "OCP" },
      // Parsed with a gap, as a real sheet often is. The partner fixes it, not GIMI.
      { first: "Salma", last: "Ouazzani", email: "", cert: CERTIFICATIONS[0], examDate: "2026-10-08", lang: "English", format: "SEB_SOFTWARE", company: "OCP" },
    ];
    notice("info", "3 rows read from the template. One is missing an email address.");
  },
  "add-blank-row"() {
    S.staging.push({ first: "", last: "", email: "", cert: "", examDate: "", lang: "English", format: "ONSITE_PROCTORED", company: "" });
  },
  "drop-stage"(el) { S.staging.splice(Number(el.dataset.id), 1); },
  "submit-staging"() {
    if (S.staging.some(rowIncomplete)) return notice("bad", "Fix the incomplete rows first.");
    DB.submissions.push({
      id: "sub" + Date.now(), partnerId: myId(),
      fileName: "enrollment_" + Date.now().toString().slice(-4) + ".xlsx",
      submittedAt: "2026-07-29", status: "PENDING", roster: [...S.staging],
    });
    notice("ok", `${S.staging.length} people sent to GIMI. They review every name before enrolling anyone.`);
    S.staging = []; S.open.enroll = false;
  },

  /* ----------------------------------------------------------- community */
  "add-post"() {
    if (!val("fo-text")) return notice("bad", "Write something first.");
    DB.forum.push({ id: "f" + Date.now(), partnerId: myId(), author: S.identity.name, when: "2026-07-29", text: val("fo-text") });
    notice("ok", "Posted.");
  },
  "toggle-directory"() {
    const me = partner(myId());
    me.visibleInDirectory = !me.visibleInDirectory;
    notice("ok", me.visibleInDirectory ? "You now appear in the directory." : "You no longer appear in the directory.");
  },

  /* --------------------------------------------------------- recognition */
  "toggle-leaderboard"() {
    DB.settings.leaderboardEnabled = !DB.settings.leaderboardEnabled;
    notice("ok", DB.settings.leaderboardEnabled
      ? "Leaderboard on. Partners now have the nav item."
      : "Leaderboard off. Partners have no nav item and the route does not exist.");
  },
  "award-month"(el) { S.awardMonth = el.value; S.pollDraft = null; },

  "add-nomination"() {
    const text = val("an-text");
    if (text.length < 5) return notice("bad", "Say what they did. Voters read this.");
    const month = val("an-month") || S.awardMonth;
    DB.nominations.push({
      id: "n" + Date.now(),
      month,
      partnerId: val("an-partner"),
      // Null author: GIMI nominated them directly rather than a partner doing it.
      byPartnerId: null,
      text,
      status: "PENDING",
    });
    S.open["add-nom"] = false;
    S.awardMonth = month;
    notice("ok", `Nomination added for ${monthName(month)}.`);
  },

  /** Turns a nomination into a poll option, which is the step that was missing. */
  "nom-to-option"(el) {
    const n = DB.nominations.find((x) => x.id === el.dataset.id);
    if (!S.pollDraft) {
      S.pollDraft = {
        month: n.month,
        question: `Who should be CTP of the Month for ${monthName(n.month)}?`,
        options: [],
      };
    }
    if (S.pollDraft.options.some((o) => o.partnerId === n.partnerId)) {
      return notice("bad", `${partnerName(n.partnerId)} is already an option.`);
    }
    // The nomination text becomes the wording voters see. Editable in the builder,
    // because a voter cannot judge a partner they know nothing about.
    S.pollDraft.options.push({
      id: "o" + Date.now(),
      partnerId: n.partnerId,
      label: `${partnerName(n.partnerId)}: ${n.text}`,
      votes: 0,
    });
    notice("ok", `${partnerName(n.partnerId)} added to the poll. Edit the wording below before opening it.`);
  },

  "csv-winners"() {
    if (DB.winners.length === 0) return notice("bad", "No winners to export.");
    downloadCsv(
      "gimi-ctp-of-the-month.csv",
      ["Month recognised", "Partner", "Country", "Region"],
      DB.winners.map((w) => {
        const p = partner(w.partnerId);
        return [monthName(w.month), p ? p.name : "", p ? p.country : "", p ? p.region : ""];
      }),
    );
    notice("ok", `Exported ${DB.winners.length} winners.`);
  },

  "start-poll"() {
    S.pollDraft = S.pollDraft
      ? null
      : {
          month: S.awardMonth,
          question: `Who should be CTP of the Month for ${monthName(S.awardMonth)}?`,
          options: [],
        };
  },
  "add-option"() {
    const label = val("po-label");
    if (label.length < 5) return notice("bad", "Write the wording voters will see.");
    S.pollDraft.options.push({ id: "o" + Date.now(), partnerId: val("po-partner"), label, votes: 0 });
  },
  "drop-option"(el) { S.pollDraft.options.splice(Number(el.dataset.id), 1); },
  "edit-option"(el) { S.pollDraft.options[Number(el.dataset.id)].label = el.value; },
  "poll-question"(el) { S.pollDraft.question = el.value; },
  "open-poll"() {
    if (S.pollDraft.options.length < 2) return notice("bad", "A poll needs at least two options.");
    DB.polls.unshift({
      id: "poll" + Date.now(),
      month: S.pollDraft.month,
      status: "OPEN",
      question: S.pollDraft.question,
      options: S.pollDraft.options,
      votedBy: [],
    });
    S.pollDraft = null;
    notice("ok", "Poll opened. Partners can vote from their dashboard.");
  },
  "close-poll"(el) {
    const poll = DB.polls.find((p) => p.id === el.dataset.id);
    poll.status = "CLOSED";
    const winner = [...poll.options].sort((a, b) => b.votes - a.votes)[0];
    DB.winners.unshift({ month: poll.month, partnerId: winner.partnerId });
    DB.nominations.filter((n) => n.month === poll.month).forEach((n) => {
      n.status = n.partnerId === winner.partnerId ? "SELECTED" : "DISMISSED";
    });
    S.awardMonth = poll.month;
    notice("ok", `${partnerName(winner.partnerId)} is CTP of the Month for ${monthName(poll.month)}.`);
  },
  "dismiss-nom"(el) {
    const n = DB.nominations.find((x) => x.id === el.dataset.id);
    n.status = "DISMISSED";
    notice("ok", "Nomination dismissed.");
  },
  vote(el) {
    const poll = DB.polls.find((p) => p.id === el.dataset.poll);
    const option = poll.options.find((o) => o.id === el.dataset.id);
    if (poll.votedBy.includes(S.identity.email)) return notice("bad", "This account has already voted.");
    option.votes += 1;
    poll.votedBy.push(S.identity.email);
    notice("ok", "Vote recorded. Results are published when the poll closes.");
  },
};

function showInviteEmail(partnerId, email, companyName) {
  S.modal = {
    title: "Invitation email",
    body: `
      <p class="count" style="margin-bottom:12px">
        No email is sent in the prototype. This is what would arrive.
      </p>
      <div class="email-preview">
        <div class="meta">To: ${esc(email)}<br>Subject: Your GIMI Partner Portal invitation</div>
        <pre>You have been invited to the GIMI Partner Portal for ${esc(companyName)}.

Open the link below to set your password and complete your organisation's details:

  https://portal.gimiinstitute.org/invite/&lt;one-time-token&gt;

This link expires in 7 days and can only be used once.

Once you have completed it, GIMI will review and activate your access.</pre>
      </div>`,
    foot: `<button class="btn btn-ghost btn-sm" data-action="close-modal">Close</button>
           <button class="btn btn-sm" data-action="open-invite" data-id="${partnerId}">Open the invitation link</button>`,
  };
}

/* ============================================================ event wiring */

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  // Clicking inside the modal must not trigger the backdrop's close.
  if (target.classList.contains("modal-backdrop") && event.target.closest("[data-stop]")) return;

  const fn = ACTIONS[target.dataset.action];
  if (!fn) return;
  S.notice = null;
  fn(target);
  render();
});

document.addEventListener("change", (event) => {
  const target = event.target;

  // Selects and result dropdowns act on change.
  if (["set-result", "set-year", "partner-status", "partner-region",
       "student-partner", "student-cert", "student-status", "student-year",
       "poll-month"].includes(target.dataset.action)) {
    S.notice = null; ACTIONS[target.dataset.action](target); render(); return;
  }

  // Staging table edits: keep the row object in step with what was typed, so the
  // completeness check reflects reality rather than the last render.
  if (target.dataset.stage) {
    const [index, field] = target.dataset.stage.split(":");
    S.staging[Number(index)][field] = target.value;
    render();
  }

  if (target.dataset.note) {
    const [pid, cid] = target.dataset.note.split(":");
    partner(pid).notes[cid] = target.value;
  }
});

/* Search boxes filter as you type, so they listen for input rather than change. */
document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.dataset.action === "partner-search" || target.dataset.action === "student-search") {
    ACTIONS[target.dataset.action](target);
    render();
    return;
  }
  // These edit state in place. Re-rendering would replace the field mid-word.
  if (["rename-column", "edit-option", "poll-question"].includes(target.dataset.action)) {
    ACTIONS[target.dataset.action](target);
  }
});

/* --------------------------------------------------------------- boot */
render();
