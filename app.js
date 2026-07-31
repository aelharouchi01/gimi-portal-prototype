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

  // Element to refocus after a re-render, so typing in a search box survives it.
  focus: null,
};

/* ----------------------------------------------------------------- helpers */

const $ = (sel) => document.querySelector(sel);

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

const PARTNER_STATUS = {
  PENDING: ["Awaiting approval", "badge-pending"],
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
        <h1 style="color:var(--teal-deep);font-size:17px">Setup complete</h1>
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
  const body = {
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
  const partnersPending = DB.partners.filter((p) => p.status === "PENDING" && p.users.length > 0);
  const reported = DB.invoices.filter((i) => i.status === "PAYMENT_REPORTED");
  const unreviewedLeads = DB.leads.filter((l) => !l.reviewed);
  const drafts = DB.invoices.filter((i) => i.status === "DRAFT");

  const items = [];
  if (subsPending.length) items.push([`${subsPending.length} submission${subsPending.length > 1 ? "s" : ""} waiting to be processed`, "students"]);
  if (partnersPending.length) items.push([`${partnersPending.length} partner${partnersPending.length > 1 ? "s" : ""} waiting for approval`, "partners"]);
  if (reported.length) items.push([`${reported.length} reported payment${reported.length > 1 ? "s" : ""} to confirm`, "invoices"]);
  if (drafts.length) items.push([`${drafts.length} draft invoice${drafts.length > 1 ? "s" : ""} not yet sent`, "invoices"]);
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
  <div class="page-head" style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap">
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

  <section class="block">
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
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:10px">
      <h2 style="margin:0">Certifications by type</h2>
      <button class="btn btn-ghost btn-sm" data-action="csv-certifications" ${certRows.length === 0 ? "disabled" : ""}>Download CSV</button>
    </div>
    <div class="table-scroll"><table>
      <thead><tr>
        <th>Certification</th><th class="num">Students</th><th class="num">Share</th>
      </tr></thead>
      <tbody>${certRows.length === 0
        ? `<tr><td colspan="3"><div class="empty" style="border:0;padding:18px">No students with an exam date in ${esc(S.year)}.</div></td></tr>`
        : certRows.map(([cert, n]) => `
        <tr>
          <td>${esc(cert)}</td>
          <td class="num">${n}</td>
          <td class="num">${Math.round((n / students.length) * 100)}%</td>
        </tr>`).join("")}
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
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:10px">
      <h2 style="margin:0">GIMI revenue by partner</h2>
      <button class="btn btn-ghost btn-sm" data-action="csv-revenue" ${rows.length === 0 ? "disabled" : ""}>Download CSV</button>
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
  const awaiting = shown.filter((p) => p.status === "PENDING");
  const rest = shown.filter((p) => p.status !== "PENDING");
  const cols = DB.customColumns;
  const regions = [...new Set(DB.partners.map((p) => p.region))].sort();
  const filtering =
    S.partnerSearch || S.partnerStatus !== "ALL" || S.partnerRegion !== "ALL";

  return `
  <div class="page-head" style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap">
    <div>
      <h1>Partners</h1>
      <p class="count">Showing ${shown.length} of ${DB.partners.length}.</p>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <input type="text" id="partner-search" data-action="partner-search" placeholder="Search partners"
        value="${esc(S.partnerSearch)}" style="width:200px;padding:6px 9px">
      <select data-action="partner-status" style="width:auto;padding:6px 8px">
        <option value="ALL" ${S.partnerStatus === "ALL" ? "selected" : ""}>All statuses</option>
        <option value="ACTIVE" ${S.partnerStatus === "ACTIVE" ? "selected" : ""}>Active</option>
        <option value="PENDING" ${S.partnerStatus === "PENDING" ? "selected" : ""}>Awaiting approval</option>
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
      <h2>Awaiting approval (${awaiting.length})</h2>
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
            <button class="btn-link" data-action="toggle-open" data-id="pw-${p.id}">${esc(p.name)}</button>
            ${invite ? `<span class="sub">Invited ${esc(invite.email)}, expires ${date(invite.expiresAt)}</span>` : ""}
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
              ${p.status === "PENDING" && p.users.length > 0 ? `<button class="btn btn-sm" data-action="approve-partner" data-id="${p.id}">Approve</button>` : ""}
              ${invite ? `<button class="btn btn-ghost btn-sm" data-action="resend-invite" data-id="${p.id}">Resend invite</button>` : ""}
              ${p.status === "ACTIVE" ? `<button class="btn btn-danger btn-sm" data-action="suspend" data-id="${p.id}">Suspend</button>` : ""}
              ${p.status === "SUSPENDED" ? `<button class="btn btn-ghost btn-sm" data-action="reactivate" data-id="${p.id}">Reactivate</button>` : ""}
            </div>
          </td>
        </tr>
        ${S.open[`pw-${p.id}`] ? partnerWorkspace(p, cols) : ""}`;
      }).join("")}
    </tbody>
  </table></div>`;
}

/* The full partner workspace, opened from a row rather than a separate tab. */
function partnerWorkspace(p, cols) {
  const students = DB.students.filter((s) => s.partnerId === p.id);
  const invoices = DB.invoices.filter((i) => i.partnerId === p.id);
  const leads = DB.leads.filter((l) => l.partnerId === p.id);
  const subs = DB.submissions.filter((s) => s.partnerId === p.id && s.status === "PENDING");
  const inv = invoices.filter((i) => i.status !== "DRAFT").reduce((n, i) => n + i.gimiAmount, 0);
  const rec = invoices.filter((i) => i.status === "PAID").reduce((n, i) => n + i.gimiAmount, 0);

  return `
  <tr class="detail-row"><td colspan="${8 + cols.length}" data-workspace="${p.id}">
    <div class="kpi-row" style="margin-bottom:18px">
      ${kpi("delivery", "Enrolled", students.length)}
      ${kpi("delivery", "Certified", students.filter((s) => s.status === "PASSED").length)}
      ${kpi("delivery", "Pass rate", passRate(students))}
      ${kpi("finance", "Invoiced", money(inv))}
      ${kpi("finance", "Received", money(rec))}
      ${kpi("finance", "Outstanding", money(inv - rec))}
    </div>

    <div class="two-col">
      <div>
        <h2 style="font-size:12px;color:var(--teal-deep);margin-bottom:8px">Internal notes (admin only)</h2>
        ${cols.map((c) => `
          <label class="field"><span>${esc(c.name)}</span>
          <input type="text" value="${esc(p.notes[c.id] || "")}" data-note="${p.id}:${c.id}"></label>`).join("")}
        <p class="count">Never included in anything a partner can read.</p>
      </div>
      <div>
        <h2 style="font-size:12px;color:var(--teal-deep);margin-bottom:8px">Contact</h2>
        <p style="font-size:13px">${esc(p.website || "No website")}<br>${esc(p.phone || "No phone")}<br>${esc(p.country || "")}</p>
        <p class="count" style="margin-top:8px">Directory: ${p.visibleInDirectory ? "opted in" : "not visible"}</p>
        <div style="margin-top:14px">
          <button class="btn btn-sm" data-action="new-invoice" data-id="${p.id}">+ New invoice</button>
        </div>
      </div>
    </div>

    ${subs.length ? `
      <h2 style="font-size:12px;color:var(--teal-deep);margin:20px 0 8px">Submissions to process (${subs.length})</h2>
      ${subs.map((s) => `<div class="status-row"><span>${esc(s.fileName)} · ${s.roster.length} people</span>
        <button class="btn btn-ghost btn-sm" data-action="admin-tab" data-tab="students">Open Students</button></div>`).join("")}` : ""}

    <h2 style="font-size:12px;color:var(--teal-deep);margin:20px 0 8px">Invoices (${invoices.length})</h2>
    ${invoices.length ? `<div class="table-scroll"><table>
      <thead><tr><th>Description</th><th>Status</th><th class="num">Partner revenue</th><th class="num">GIMI amount</th></tr></thead>
      <tbody>${invoices.map((i) => `<tr>
        <td>${esc(i.description)}</td><td>${invoiceBadge(i.status)}</td>
        <td class="num">${money(i.partnerRevenue)}</td><td class="num">${money(i.gimiAmount)}</td></tr>`).join("")}</tbody>
    </table></div>` : `<div class="empty">No invoices yet.</div>`}

    <h2 style="font-size:12px;color:var(--teal-deep);margin:20px 0 8px">Leads (${leads.length})</h2>
    ${leads.length ? `<div class="table-scroll"><table>
      <thead><tr><th>Company</th><th>Stage</th><th>Probability</th><th class="num">Expected</th></tr></thead>
      <tbody>${leads.map((l) => `<tr><td>${esc(l.company)}</td><td>${esc(LEAD_STAGE[l.stage])}</td>
        <td>${esc(l.probability)}</td><td class="num">${money(l.expectedRevenue)}</td></tr>`).join("")}</tbody>
    </table></div>` : `<div class="empty">No leads yet.</div>`}
  </td></tr>`;
}

/* -------------------------------------------------------- admin: students */

function adminStudents() {
  const pending = DB.submissions.filter((s) => s.status === "PENDING");

  return `
  <div class="page-head">
    <h1>Students</h1>
    <p class="count">Showing ${DB.students.length} of ${DB.students.length} enrolled.</p>
  </div>

  <section class="block">
    <h2>Submissions to process (${pending.length})</h2>
    ${pending.length === 0 ? `<div class="empty">Nothing waiting. Submissions appear here when a partner sends a roster.</div>` : `
      <div class="table-scroll"><table>
        <thead><tr><th>Partner</th><th>File</th><th class="num">People</th><th>Received</th><th>Completeness</th><th class="right">Actions</th></tr></thead>
        <tbody>${pending.map((sub) => {
          const blocked = submissionBlocked(sub);
          return `
          <tr>
            <td>${esc(partnerName(sub.partnerId))}</td>
            <td><button class="btn-link" data-action="toggle-open" data-id="sub-${sub.id}">${esc(sub.fileName)}</button>
                <span class="sub">${S.open["sub-" + sub.id] ? "Hide" : "Show"} the ${sub.roster.length} people</span></td>
            <td class="num">${sub.roster.length}</td>
            <td class="nowrap">${date(sub.submittedAt)}</td>
            <td>${blocked
              ? badge(`${sub.roster.filter(rowIncomplete).length} row(s) incomplete`, "badge-pending")
              : badge("Complete", "badge-paid")}</td>
            <td><div class="row-actions">
              <button class="btn btn-sm" data-action="confirm-sub" data-id="${sub.id}" ${blocked ? "disabled" : ""}>Confirm</button>
              <button class="btn btn-danger btn-sm" data-action="reject-sub" data-id="${sub.id}">Reject</button>
            </div></td>
          </tr>
          ${S.open["sub-" + sub.id] ? rosterRow(sub) : ""}`;
        }).join("")}</tbody>
      </table></div>
      <p class="count" style="margin-top:8px">
        Confirming creates the students and raises a draft invoice, in one step.
        A submission cannot be confirmed while any row is missing a required field.
      </p>`}
  </section>

  <section class="block">
    <h2>All students</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>Name</th><th>Partner</th><th>Certification</th><th>Exam date</th><th>Language</th><th>Result</th></tr></thead>
      <tbody>${DB.students.map((s) => `
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
          </td>
        </tr>`).join("")}
      </tbody>
    </table></div>
    <p class="count" style="margin-top:8px">
      Results are set by hand here. Moodle owns the exam itself and the three-attempt rule.
    </p>
  </section>`;
}

function rosterRow(sub) {
  return `
  <tr class="detail-row"><td colspan="6">
    <h2 style="font-size:12px;color:var(--teal-deep);margin-bottom:8px">
      Every person in ${esc(sub.fileName)} — ${sub.roster.length} rows
    </h2>
    <div class="table-scroll" style="background:var(--white)"><table>
      <thead><tr><th>First</th><th>Last</th><th>Email</th><th>Certification</th><th>Exam date</th><th>Format</th><th>Company</th></tr></thead>
      <tbody>${sub.roster.map((r) => `
        <tr ${rowIncomplete(r) ? 'style="background:rgba(222,142,61,.08)"' : ""}>
          <td>${esc(r.first) || missing()}</td>
          <td>${esc(r.last) || missing()}</td>
          <td>${esc(r.email) || missing()}</td>
          <td>${esc(r.cert) || missing()}</td>
          <td class="nowrap">${r.examDate ? date(r.examDate) : missing()}</td>
          <td>${esc(EXAM_FORMATS.find((f) => f.value === r.format)?.label ?? "—")}</td>
          <td>${esc(r.company || "—")}</td>
        </tr>`).join("")}
      </tbody>
    </table></div>
    <p class="count" style="margin-top:8px">
      GIMI sees every name and email before confirming. A count is never stored without the people.
    </p>
  </td></tr>`;
}

const missing = () => `<span style="color:var(--magenta)">missing</span>`;

/* -------------------------------------------------------- admin: invoices */

function adminInvoices() {
  const byPartner = DB.partners.map((p) => {
    const rows = DB.invoices.filter((i) => i.partnerId === p.id && i.status !== "DRAFT");
    const invoiced = rows.reduce((n, i) => n + i.gimiAmount, 0);
    const received = rows.filter((i) => i.status === "PAID").reduce((n, i) => n + i.gimiAmount, 0);
    return { p, revenue: rows.reduce((n, i) => n + i.partnerRevenue, 0), invoiced, received };
  }).filter((r) => r.invoiced > 0);

  return `
  <div class="page-head">
    <h1>Invoices</h1>
    <p class="count">Showing ${DB.invoices.length} of ${DB.invoices.length}, including drafts.</p>
  </div>

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
  </section>

  <section class="block">
    <div class="adder">
      <div class="adder-head">
        <h2>New invoice</h2>
        <button class="btn btn-sm" data-action="toggle-open" data-id="add-invoice">
          ${S.open["add-invoice"] ? "Cancel" : "+ New invoice"}
        </button>
      </div>
      ${S.open["add-invoice"] ? invoiceForm() : ""}
    </div>

    <h2>All invoices</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>Partner</th><th>Description</th><th class="num">People</th><th class="num">Partner revenue</th><th class="num">GIMI amount</th><th>Status</th><th>Due</th><th class="right">Actions</th></tr></thead>
      <tbody>${DB.invoices.map((i) => `
        <tr>
          <td>${esc(partnerName(i.partnerId))}</td>
          <td>${esc(i.description)}${i.pdf ? `<span class="sub">${esc(i.pdf)}${i.qbRef ? " · " + esc(i.qbRef) : ""}</span>` : `<span class="sub">No PDF uploaded</span>`}</td>
          <td class="num">${i.studentCount}</td>
          <td class="num">${money(i.partnerRevenue)}</td>
          <td class="num">${money(i.gimiAmount)}</td>
          <td>${invoiceBadge(i.status)}${i.payment ? `<span class="sub">${esc(i.payment.reference)}</span>` : ""}</td>
          <td class="nowrap">${date(i.dueDate)}</td>
          <td><div class="row-actions">
            ${i.status === "DRAFT" ? `<button class="btn btn-sm" data-action="open-send" data-id="${i.id}">Upload PDF and send</button>` : ""}
            ${i.status === "PAYMENT_REPORTED" ? `
              <button class="btn btn-sm" data-action="confirm-payment" data-id="${i.id}">Funds received</button>
              <button class="btn btn-danger btn-sm" data-action="reject-payment" data-id="${i.id}">Not received</button>` : ""}
            ${i.status === "PAID" ? `<span style="font-size:11.5px;color:var(--faint)">Locked</span>` : ""}
          </div></td>
        </tr>`).join("")}
      </tbody>
    </table></div>
    <div class="legend">
      <span>${invoiceBadge("DRAFT")} invisible to the partner</span>
      <span>${invoiceBadge("SENT")} awaiting payment</span>
      <span>${invoiceBadge("PAYMENT_REPORTED")} partner says paid</span>
      <span>${invoiceBadge("PAID")} confirmed, no longer editable</span>
    </div>
    <p class="count" style="margin-top:10px">
      Partner revenue and GIMI amount are typed in separately. There is no percentage between them.
    </p>
  </section>`;
}

function invoiceForm() {
  return `
  <div class="adder-body">
    <div class="grid-2">
      <label class="field"><span>Partner</span>
        <select id="ni-partner">${DB.partners.filter((p) => p.status === "ACTIVE").map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></label>
      <label class="field"><span>Description</span><input type="text" id="ni-desc" placeholder="CIL cohort, September 2026"></label>
      <label class="field"><span>Partner revenue</span><input type="text" id="ni-rev" placeholder="48000">
        <span class="hint">What the partner charges its own client.</span></label>
      <label class="field"><span>GIMI amount</span><input type="text" id="ni-gimi" placeholder="14400">
        <span class="hint">What GIMI invoices them. Unrelated by formula.</span></label>
      <label class="field"><span>People</span><input type="number" id="ni-count" value="1" min="1"></label>
      <label class="field"><span>Due date</span><input type="date" id="ni-due" value="2026-09-30"></label>
    </div>
    <button class="btn btn-sm" data-action="create-invoice">Create as draft</button>
    <span style="font-size:11.5px;color:var(--faint);margin-left:10px">Drafts are never visible to the partner.</span>
  </div>`;
}

/* ----------------------------------------------------------- admin: leads */

function adminLeads() {
  const sorted = [...DB.leads].sort((a, b) => Number(a.reviewed) - Number(b.reviewed));
  const unreviewed = DB.leads.filter((l) => !l.reviewed).length;

  return `
  <div class="page-head">
    <h1>Leads</h1>
    <p class="count">Showing ${DB.leads.length} of ${DB.leads.length}. ${unreviewed} not yet reviewed.</p>
  </div>
  <div class="table-scroll"><table>
    <thead><tr><th>Company</th><th>Partner</th><th>Stage</th><th>Probability</th><th>Met</th><th>Docs sent</th><th class="num">Expected</th><th>Close</th><th class="right">Actions</th></tr></thead>
    <tbody>${sorted.map((l) => `
      <tr>
        <td><button class="btn-link" data-action="toggle-open" data-id="lead-${l.id}">${esc(l.company)}</button>
            <span class="sub">${esc(l.contact)}</span></td>
        <td>${esc(partnerName(l.partnerId))}</td>
        <td>${esc(LEAD_STAGE[l.stage])}</td>
        <td>${esc(l.probability)}</td>
        <td>${esc(MET_STATUS[l.metStatus])}</td>
        <td>${esc(DOCS_SENT[l.docsSent])}</td>
        <td class="num">${money(l.expectedRevenue)}</td>
        <td class="nowrap">${date(l.expectedCloseDate)}</td>
        <td><div class="row-actions">
          ${l.reviewed ? badge("Reviewed", "badge-neutral") : `<button class="btn btn-sm" data-action="review-lead" data-id="${l.id}">Mark reviewed</button>`}
        </div></td>
      </tr>
      ${S.open["lead-" + l.id] ? `
        <tr class="detail-row"><td colspan="9">
          <div class="two-col">
            <div>
              <h2 style="font-size:12px;color:var(--teal-deep);margin-bottom:6px">Products of interest</h2>
              ${l.products.map((p) => `<span class="chip">${esc(p)}</span>`).join("")}
            </div>
            <div>
              <h2 style="font-size:12px;color:var(--teal-deep);margin-bottom:6px">Support the partner asked for</h2>
              <p style="font-size:13px">${esc(l.supportNeeded) || "Nothing recorded."}</p>
              <p class="count" style="margin-top:6px">Website: ${esc(l.website || "—")}</p>
            </div>
          </div>
        </td></tr>` : ""}`).join("")}
    </tbody>
  </table></div>`;
}

/* ----------------------------------------------------- admin: recognition */

function adminRecognition() {
  const open = DB.polls.find((p) => p.status === "OPEN");
  const closed = DB.polls.filter((p) => p.status === "CLOSED");
  const nominations = DB.nominations.filter((n) => n.status === "PENDING");

  const ranking = DB.partners
    .map((p) => {
      const rows = DB.invoices.filter((i) => i.partnerId === p.id && i.status !== "DRAFT");
      return { p, revenue: rows.reduce((n, i) => n + i.partnerRevenue, 0), certified: DB.students.filter((s) => s.partnerId === p.id && s.status === "PASSED").length };
    })
    .sort((a, b) => b.revenue - a.revenue);
  const maxRevenue = Math.max(1, ...ranking.map((r) => r.revenue));

  return `
  <div class="page-head"><h1>Recognition</h1></div>

  <div class="toggle-row">
    <div>
      <div class="lbl">Partner leaderboard</div>
      <span class="sub">When off, partners have no leaderboard nav item and the route does not exist.</span>
    </div>
    <button class="btn ${DB.settings.leaderboardEnabled ? "btn-danger" : ""} btn-sm" data-action="toggle-leaderboard">
      ${DB.settings.leaderboardEnabled ? "Turn off" : "Turn on"}
    </button>
  </div>

  <section class="block">
    <h2>CTP of the Month</h2>
    ${open ? pollAdminCard(open) : `
      <div class="adder">
        <div class="adder-head">
          <h2>Run a poll</h2>
          <button class="btn btn-sm" data-action="start-poll">${S.pollDraft ? "Cancel" : "+ New poll"}</button>
        </div>
        ${S.pollDraft ? pollBuilder() : `<div class="adder-body"><p class="count">No poll is running. Nominations are collected first, then you write the options.</p></div>`}
      </div>`}
  </section>

  <section class="block">
    <h2>Nominations for ${monthName("2026-07")} (${nominations.length})</h2>
    ${nominations.length === 0 ? `<div class="empty">No nominations yet.</div>` : `
      <div class="table-scroll"><table>
        <thead><tr><th>Nominated</th><th>Nominated by</th><th>Why</th><th class="right">Actions</th></tr></thead>
        <tbody>${nominations.map((n) => `
          <tr>
            <td>${esc(partnerName(n.partnerId))}</td>
            <td>${n.byPartnerId === null ? `<span style="color:var(--faint)">GIMI</span>` : esc(partnerName(n.byPartnerId))}
              ${n.byPartnerId === n.partnerId ? `<span class="sub">self-nominated</span>` : ""}</td>
            <td>${esc(n.text)}</td>
            <td><div class="row-actions">
              <button class="btn btn-ghost btn-sm" data-action="dismiss-nom" data-id="${n.id}">Dismiss</button>
            </div></td>
          </tr>`).join("")}
        </tbody>
      </table></div>`}
  </section>

  <section class="block">
    <h2>Past winners</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>Month</th><th>Partner</th></tr></thead>
      <tbody>${DB.winners.map((w) => `<tr><td>${esc(monthName(w.month))}</td><td>${esc(partnerName(w.partnerId))}</td></tr>`).join("")}</tbody>
    </table></div>
  </section>

  <section class="block">
    <h2>Revenue ranking (admin only)</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>#</th><th>Partner</th><th class="num">Partner revenue</th><th style="width:30%">Share</th><th class="num">Certified</th></tr></thead>
      <tbody>${ranking.map((r, n) => `
        <tr>
          <td>${n + 1}</td>
          <td>${esc(r.p.name)}</td>
          <td class="num">${money(r.revenue)}</td>
          <td><div class="bar"><i style="width:${(r.revenue / maxRevenue) * 100}%"></i></div></td>
          <td class="num">${r.certified}</td>
        </tr>`).join("")}
      </tbody>
    </table></div>
    <p class="count" style="margin-top:8px">Never shown to partners. The partner leaderboard ranks people certified and carries no money figure.</p>
  </section>

  ${closed.length ? `
    <section class="block">
      <h2>Closed polls</h2>
      ${closed.map((p) => `
        <div class="panel" style="padding:16px;margin-bottom:10px">
          <h2 style="font-size:13px;color:var(--teal-deep);margin-bottom:10px">${esc(monthName(p.month))} — ${esc(p.question)}</h2>
          ${pollResults(p)}
        </div>`).join("")}
    </section>` : ""}`;
}

function pollAdminCard(poll) {
  const total = poll.options.reduce((n, o) => n + o.votes, 0);
  return `
  <div class="panel" style="padding:18px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div>
        <h2 style="font-size:14px;color:var(--teal-deep)">${esc(poll.question)}</h2>
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
  <div class="adder-body">
    <div class="grid-2">
      <label class="field"><span>Month being recognised</span>
        <select id="pd-month">
          <option value="2026-07">July 2026</option>
          <option value="2026-08">August 2026</option>
        </select>
        <span class="hint">July's award, decided in August, files under July.</span>
      </label>
      <label class="field"><span>Question</span><input type="text" id="pd-q" value="${esc(d.question)}"></label>
    </div>

    <h2 style="font-size:12px;color:var(--teal-deep);margin:6px 0 8px">Options (${d.options.length})</h2>
    ${d.options.length === 0 ? `<p class="count" style="margin-bottom:10px">No options yet. You write the wording; voters see only that.</p>` : ""}
    ${d.options.map((o, n) => `
      <div class="poll-option">
        <div style="flex:1">
          <div>${esc(o.label)}</div>
          <div class="who">Tagged to ${esc(partnerName(o.partnerId))}</div>
        </div>
        <button class="btn btn-danger btn-sm" data-action="drop-option" data-id="${n}">Remove</button>
      </div>`).join("")}

    <div class="grid-2" style="margin-top:12px">
      <label class="field"><span>Which partner is this about</span>
        <select id="po-partner">${DB.partners.filter((p) => p.status === "ACTIVE").map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select>
        <span class="hint">Invisible to voters. It links the winner to a real partner so rankings work.</span>
      </label>
      <label class="field"><span>Wording voters will see</span>
        <textarea id="po-label" placeholder="Partner X: trained 40 people across 3 countries to achieve Y."></textarea>
      </label>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" data-action="add-option">Add option</button>
      <button class="btn btn-sm" data-action="open-poll" ${d.options.length < 2 ? "disabled" : ""}>Open poll to partners</button>
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

  const body = {
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

  <section class="block">
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

  ${openPoll ? `
    <section class="block">
      <h2>CTP of the Month vote</h2>
      <div class="panel" style="padding:18px">
        <h2 style="font-size:14px;color:var(--teal-deep)">${esc(openPoll.question)}</h2>
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
          ? `<span style="font-size:12px;color:var(--magenta)">${bad} row${bad > 1 ? "s" : ""} incomplete. Fix them before sending.</span>`
          : `<span style="font-size:11.5px;color:var(--faint)">Every row has the fields GIMI requires.</span>`}
      </div>`}
  </div>`;
}

function partnerInvoices() {
  const rows = myInvoices();
  return `
  <div class="page-head">
    <h1>Invoices</h1>
    <p class="count">Showing ${rows.length} of ${rows.length}.</p>
  </div>

  ${rows.length === 0 ? `<div class="empty">No invoices yet.</div>` : `
    <div class="table-scroll"><table>
      <thead><tr><th>Description</th><th class="num">People</th><th class="num">Your revenue</th><th class="num">GIMI amount</th><th>Status</th><th>Due</th><th class="right">Actions</th></tr></thead>
      <tbody>${rows.map((i) => `
        <tr>
          <td>${esc(i.description)}</td>
          <td class="num">${i.studentCount}</td>
          <td class="num">${money(i.partnerRevenue)}</td>
          <td class="num">${money(i.gimiAmount)}</td>
          <td>${invoiceBadge(i.status)}${i.payment ? `<span class="sub">${esc(i.payment.reference)}</span>` : ""}</td>
          <td class="nowrap">${date(i.dueDate)}</td>
          <td><div class="row-actions">
            ${i.pdf ? `<button class="btn btn-ghost btn-sm" data-action="download" data-id="${i.id}">Download PDF</button>` : ""}
            ${i.status === "SENT" ? `<button class="btn btn-sm" data-action="open-report" data-id="${i.id}">Report payment</button>` : ""}
          </div></td>
        </tr>`).join("")}
      </tbody>
    </table></div>`}

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

  ${rows.length === 0 ? `<div class="empty">No leads shared yet.</div>` : `
    <div class="table-scroll"><table>
      <thead><tr><th>Company</th><th>Stage</th><th>Probability</th><th>Met</th><th>Docs sent</th><th class="num">Expected</th><th>GIMI</th></tr></thead>
      <tbody>${rows.map((l) => `
        <tr>
          <td>${esc(l.company)}<span class="sub">${esc(l.contact)}</span></td>
          <td>${esc(LEAD_STAGE[l.stage])}</td>
          <td>${esc(l.probability)}</td>
          <td>${esc(MET_STATUS[l.metStatus])}</td>
          <td>${esc(DOCS_SENT[l.docsSent])}</td>
          <td class="num">${money(l.expectedRevenue)}</td>
          <td>${l.reviewed ? badge("Reviewed", "badge-paid") : badge("With GIMI", "badge-pending")}</td>
        </tr>`).join("")}
      </tbody>
    </table></div>`}`;
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
  <div class="page-head"><h1>Profile</h1></div>
  <div class="panel" style="max-width:640px">
    <div class="grid-2">
      <label class="field"><span>Company name</span><input type="text" value="${esc(me.name)}"></label>
      <label class="field"><span>Country</span><input type="text" value="${esc(me.country)}"></label>
      <label class="field"><span>Website</span><input type="text" value="${esc(me.website)}"></label>
      <label class="field"><span>Phone</span><input type="text" value="${esc(me.phone)}"></label>
      <label class="field"><span>Annual revenue target</span><input type="text" value="${me.expectedRevenue ? Math.round(me.expectedRevenue / 100) : ""}"></label>
    </div>
    <div class="toggle-row" style="margin-top:6px">
      <div>
        <div class="lbl">Show us in the partner directory</div>
        <span class="sub">Other partners can see your name, country and website.</span>
      </div>
      <button class="btn ${me.visibleInDirectory ? "btn-danger" : ""} btn-sm" data-action="toggle-directory">
        ${me.visibleInDirectory ? "Turn off" : "Turn on"}
      </button>
    </div>
    <h2 style="font-size:12px;color:var(--teal-deep);margin:18px 0 8px">Logins on this account</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>Name</th><th>Email</th><th>Last signed in</th></tr></thead>
      <tbody>${me.users.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td class="nowrap">${date(u.lastLogin)}</td></tr>`).join("")}</tbody>
    </table></div>
    <p class="count" style="margin-top:8px">Every login has the same rights. Add another and they can do everything you can.</p>
    <div style="margin-top:12px"><button class="btn btn-ghost btn-sm" data-action="stub">+ Add another login</button></div>
  </div>`;
}

/* ---------------------------------------------------------------- modal */

function modalHtml() {
  if (!S.modal) return "";
  return `
  <div class="modal-backdrop" data-action="close-modal">
    <div class="modal" data-stop="1">
      <div class="modal-head">
        <h2>${esc(S.modal.title)}</h2>
        <button class="close-x" data-action="close-modal">&times;</button>
      </div>
      <div class="modal-body">${S.modal.body}</div>
      <div class="modal-foot">${S.modal.foot ?? `<button class="btn btn-ghost btn-sm" data-action="close-modal">Close</button>`}</div>
    </div>
  </div>`;
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
    notice("info", `${i.pdf} would download here.`);
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
      id, name, country: "", status: "PENDING", website: "", linkedin: "", phone: "",
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
    // The invitation is spent, so the link stops working.
    DB.invites = DB.invites.filter((i) => i.partnerId !== p.id);

    S.screen = "done";
    S.notice = null;
  },

  "approve-partner"(el) {
    const p = partner(el.dataset.id);
    if (p.users.length === 0)
      return notice("bad", "Nobody has completed the invitation yet, so there is no one to approve.");
    p.status = "ACTIVE"; p.approvedAt = "2026-07-29";
    notice("ok", `${p.name} approved. They can now sign in.`);
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
  "manage-columns"() {
    S.modal = {
      title: "Manage columns",
      body: `
        ${DB.customColumns.map((c) => `<label class="field"><span>Column ${c.position}</span><input type="text" value="${esc(c.name)}"></label>`).join("")}
        <p class="count">These columns and their contents are admin-only. They never appear in anything a partner can read.</p>`,
    };
  },

  /* ------------------------------------------------- students: submissions */
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
    notice("ok", `${sub.roster.length} students created and a draft invoice raised. The partner cannot see the draft.`);
  },
  "reject-sub"(el) {
    const sub = DB.submissions.find((s) => s.id === el.dataset.id);
    sub.status = "REJECTED";
    notice("ok", `${sub.fileName} rejected. The partner is told why.`);
  },
  "set-result"(el) {
    const s = DB.students.find((x) => x.id === el.dataset.id);
    s.status = el.value;
    notice("ok", `${s.first} ${s.last} marked ${STUDENT_STATUS[el.value].toLowerCase()}.`);
  },

  /* ------------------------------------------------------------- invoices */
  "create-invoice"() {
    const rev = centsFrom(val("ni-rev")), gimi = centsFrom(val("ni-gimi"));
    if (!val("ni-desc")) return notice("bad", "Give the invoice a description.");
    if (rev === null || gimi === null) return notice("bad", "Both figures must be numbers. They are unrelated to each other.");
    DB.invoices.push({
      id: "inv" + Date.now(), partnerId: val("ni-partner"), description: val("ni-desc"),
      studentCount: Number(val("ni-count")) || 1, partnerRevenue: rev, gimiAmount: gimi,
      status: "DRAFT", issuedAt: null, dueDate: val("ni-due"), pdf: null, qbRef: null, payment: null,
    });
    S.open["add-invoice"] = false;
    notice("ok", "Draft created. It is invisible to the partner until you send it.");
  },
  "open-send"(el) {
    const i = DB.invoices.find((x) => x.id === el.dataset.id);
    S.modal = {
      title: "Upload PDF and send",
      body: `
        <p class="count" style="margin-bottom:14px">Invoices are authored in QuickBooks. Upload the PDF and confirm both figures.</p>
        <label class="field"><span>PDF from QuickBooks</span><input type="text" id="sd-pdf" value="GIMI-2026-0${Math.floor(Math.random() * 90 + 10)}.pdf"></label>
        <label class="field"><span>QuickBooks reference <span class="optional">(optional)</span></span><input type="text" id="sd-qb" placeholder="QB-1070"></label>
        <div class="grid-2">
          <label class="field"><span>Partner revenue</span><input type="text" id="sd-rev" value="${i.partnerRevenue ? Math.round(i.partnerRevenue / 100) : ""}"></label>
          <label class="field"><span>GIMI amount</span><input type="text" id="sd-gimi" value="${i.gimiAmount ? Math.round(i.gimiAmount / 100) : ""}"></label>
        </div>
        <p class="count">Two independent figures. Both freeze once sent.</p>`,
      foot: `<button class="btn btn-ghost btn-sm" data-action="close-modal">Cancel</button>
             <button class="btn btn-sm" data-action="send-invoice" data-id="${i.id}">Send to partner</button>`,
    };
  },
  "send-invoice"(el) {
    const i = DB.invoices.find((x) => x.id === el.dataset.id);
    const rev = centsFrom(val("sd-rev")), gimi = centsFrom(val("sd-gimi"));
    if (!val("sd-pdf")) return notice("bad", "A draft cannot be sent without a PDF.");
    if (gimi === null || gimi === 0) return notice("bad", "A draft cannot be sent without a GIMI amount.");
    if (rev === null) return notice("bad", "Partner revenue must be a number.");
    i.pdf = val("sd-pdf"); i.qbRef = val("sd-qb") || null;
    i.partnerRevenue = rev; i.gimiAmount = gimi;
    i.status = "SENT"; i.issuedAt = "2026-07-29";
    S.modal = null;
    notice("ok", `Sent. ${partnerName(i.partnerId)} is notified by email and can now see it.`);
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
  "start-poll"() {
    S.pollDraft = S.pollDraft ? null : { month: "2026-07", question: "Who should be CTP of the Month for July 2026?", options: [] };
  },
  "add-option"() {
    const label = val("po-label");
    if (label.length < 5) return notice("bad", "Write the wording voters will see.");
    S.pollDraft.options.push({ id: "o" + Date.now(), partnerId: val("po-partner"), label, votes: 0 });
  },
  "drop-option"(el) { S.pollDraft.options.splice(Number(el.dataset.id), 1); },
  "open-poll"() {
    if (S.pollDraft.options.length < 2) return notice("bad", "A poll needs at least two options.");
    DB.polls.unshift({
      id: "poll" + Date.now(), month: val("pd-month") || S.pollDraft.month,
      status: "OPEN", question: val("pd-q") || S.pollDraft.question,
      options: S.pollDraft.options, votedBy: [],
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
  if (["set-result", "set-year", "partner-status", "partner-region"].includes(target.dataset.action)) {
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
  if (target.dataset.action === "partner-search") {
    ACTIONS["partner-search"](target);
    render();
  }
});

/* --------------------------------------------------------------- boot */
render();
