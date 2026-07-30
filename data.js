/* ===========================================================================
   Prototype data.

   Partners are REAL, from "All Current CTPs" in the CTP Strategy workbook.
   The 29 certifications are REAL, from GIMI_Product_Catalogue_V68.pptx, with the
   catalogue's own descriptions and prices. Both arrive via real-data.js.

   Students, invoices, leads and votes are invented, because no real figures for
   those were supplied.

   Money is integer cents. Invoices carry two independent figures and there is
   no percentage anywhere in this file, per CLAUDE.md.

   Held in memory: a refresh resets everything.
   =========================================================================== */

const EXAM_LANGUAGES = ["English", "Spanish", "Arabic", "Portuguese", "French", "Japanese"];
const EXAM_FORMATS = [
  { value: "ONSITE_PROCTORED", label: "Onsite, proctored" },
  { value: "SEB_SOFTWARE", label: "Safe Exam Browser" },
];

/* GIMI's own words for how engaged a partner is. This is a real dimension in
   their spreadsheet that the portal schema does not have, so it is carried as
   an admin-only custom column rather than being forced into `status`. */
const ACTIVITY_TO_STATUS = {
  "Active": "ACTIVE",
  "Semi active": "ACTIVE",
  "Passive": "ACTIVE",
  "New partner": "PENDING",
};

const slug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* ------------------------------------------------------------------ build */

const DB = {
  settings: { leaderboardEnabled: false },

  /* Two admin-only columns, one of which carries GIMI's activity assessment.
     Neither is ever included in anything a partner can read. */
  customColumns: [
    { id: 1, name: "Activity", position: 1 },
    { id: 2, name: "Internal note", position: 2 },
  ],

  partners: REAL_PARTNERS.map((r, index) => ({
    // Derived from position, not from a field in the generated file. It was built
    // from a row number once, the generator stopped emitting it, and every partner
    // silently became "pundefined" — which made every partner-scoped filter return
    // the whole network.
    id: "p" + (index + 1),
    name: r.name,
    country: r.country || "—",
    region: r.region || "—",
    partnerType: r.type || "—",
    status: ACTIVITY_TO_STATUS[r.activity] ?? "ACTIVE",
    website: r.contacts[0] ? r.contacts[0].split("@")[1] : "",
    linkedin: "",
    phone: "",
    // Not supplied in the workbook. Left null rather than invented, so nobody
    // mistakes a made-up target for a real one.
    expectedRevenue: null,
    visibleInDirectory: r.activity === "Active",
    createdAt: "2025-01-15",
    approvedAt: r.activity === "New partner" ? null : "2025-01-20",
    users: r.contacts.map((email, n) => ({
      name: n === 0 ? r.contactName || email.split("@")[0] : email.split("@")[0],
      email,
      lastLogin: r.activity === "Active" ? "2026-07-27" : r.activity === "Semi active" ? "2026-06-12" : null,
    })),
    notes: { 1: r.activity, 2: "" },
  })),

  invites: [],
  students: [],
  submissions: [],
  invoices: [],
  leads: [],
  nominations: [],
  winners: [],
  polls: [],

  /* The real product catalogue, straight from GIMI_Product_Catalogue_V68.pptx:
     29 certifications with descriptions, what is included, skills, career
     outcomes, exam format and published prices. Partners browse this in the
     Library to see what they can sell and deliver. */
  catalogue: CATALOGUE,

  library: [
    { id: "d1", name: "GIMI certification overview", kind: "Deck", updated: "2026-06-02" },
    { id: "d2", name: "Partner proposal template", kind: "Deck", updated: "2026-05-18" },
    { id: "d3", name: "Innovation Management Body of Knowledge", kind: "Book", updated: "2026-01-20" },
    { id: "d4", name: "Enrollment template", kind: "Spreadsheet", updated: "2026-07-01" },
    { id: "d5", name: "Online exam instructions for candidates", kind: "Document", updated: "2026-04-11" },
  ],

  forum: [],
};

/* ------------------------------- a few partners get invented delivery data
   Enough to make the screens read as populated. Lesson 6: a demo must never
   open empty. Everything below is invented and labelled as such in the UI. */

const active = DB.partners.filter((p) => p.status === "ACTIVE");
const pick = (list, n) => list[n % list.length];

const FIRST = ["Nadia","Omar","Leila","Karim","Anna","Lars","Sofia","Ahmed","Mariam","Yousef","Diego","Valentina","Kwame","Aisha","Chen","Priya","Tunde","Rafael","Elena","Hassan"];
const LAST = ["Alaoui","Fassi","Cherkaoui","Benali","Bergström","Nyberg","Holm","Al Suwaidi","Hassan","Khalid","Muñoz","Soto","Mensah","Bello","Wei","Sharma","Adeyemi","Costa","Petrova","Nasser"];
const RESULTS = ["PASSED","PASSED","PASSED","PASSED","FAILED","IN_PROGRESS","ENROLLED"];

/* Weighted to the shape of GIMI's real LMS enrolment, where Level 1 Associate
   dwarfs everything else, then Level 2 Master and Catalyst, with a long tail.
   An even spread across all 29 certifications is not what the network looks
   like, and it makes "certifications by type" say nothing. */
const CERT_WEIGHTS = [
  ["Certified Innovation Professional Level 1: Associate", 22],
  ["Certified Innovation Professional Level 2: Master", 7],
  ["Problem Solving Certified Catalyst", 6],
  ["Certified Chief Innovation Officer Level 3: Manager", 4],
  ["Primer", 3],
  ["Certified Design Thinking: Level 1", 3],
  ["Certified Foresight Professional: Level 1", 3],
  ["Certified Chief Innovation Officer Level 4: Leader", 2],
  ["Certified GIMI Impact: Students", 2],
];

// Guards against a rename in the catalogue silently producing students enrolled
// on a certification that no longer exists.
const CERT_POOL = CERT_WEIGHTS
  .filter(([name]) => CERTIFICATIONS.includes(name))
  .flatMap(([name, weight]) => Array(weight).fill(name));

const ENROLLABLE = CERT_POOL.length ? CERT_POOL : CERTIFICATIONS;

// Named rather than indexed, so reordering the catalogue cannot silently change
// which certification a seeded roster is for.
const CERT_L1 = "Certified Innovation Professional Level 1: Associate";
const CERT_L2 = "Certified Innovation Professional Level 2: Master";
const CERT_CCIO3 = "Certified Chief Innovation Officer Level 3: Manager";

let sid = 0;
active.slice(0, 12).forEach((p, pi) => {
  const howMany = 3 + (pi % 4);
  for (let i = 0; i < howMany; i++) {
    sid += 1;
    DB.students.push({
      id: "s" + sid,
      partnerId: p.id,
      first: pick(FIRST, sid * 3),
      last: pick(LAST, sid * 5),
      email: `${pick(FIRST, sid * 3).toLowerCase()}.${pick(LAST, sid * 5).toLowerCase().replace(/[^a-z]/g, "")}@example.com`,
      city: "",
      country: p.country,
      company: "",
      cert: pick(ENROLLABLE, sid * 7 + pi * 3),
      examDate: `2026-0${(sid % 7) + 1}-1${sid % 9}`,
      lang: pick(EXAM_LANGUAGES, pi),
      format: sid % 2 ? "ONSITE_PROCTORED" : "SEB_SOFTWARE",
      status: pick(RESULTS, sid),
    });
  }
});

/* Two submissions waiting, one deliberately incomplete so the completeness
   check has something to catch. */
DB.submissions.push(
  {
    id: "sub1", partnerId: active[0].id,
    fileName: `${slug(active[0].name)}_enrollment_sept.xlsx`,
    submittedAt: "2026-07-27", status: "PENDING",
    roster: [
      { first: "Hicham", last: "Tazi", email: "hicham.tazi@example.com", cert: CERT_L1, examDate: "2026-09-12", lang: "English", format: "ONSITE_PROCTORED", company: "Ministry of Industry" },
      { first: "Amina", last: "Berrada", email: "amina.berrada@example.com", cert: CERT_L1, examDate: "2026-09-12", lang: "English", format: "ONSITE_PROCTORED", company: "Ministry of Industry" },
      { first: "Rachid", last: "Moussaoui", email: "rachid.m@example.com", cert: CERT_L2, examDate: "2026-09-12", lang: "French", format: "SEB_SOFTWARE", company: "Lydec" },
    ],
  },
  {
    id: "sub2", partnerId: active[1].id,
    fileName: `${slug(active[1].name)}_batch_04.xlsx`,
    submittedAt: "2026-07-28", status: "PENDING",
    roster: [
      { first: "Noura", last: "Al Zaabi", email: "noura@example.com", cert: CERT_CCIO3, examDate: "2026-10-01", lang: "Arabic", format: "ONSITE_PROCTORED", company: "Masdar" },
      // No email. Blocks confirmation until the partner fixes it.
      { first: "Saeed", last: "Al Nuaimi", email: "", cert: CERT_CCIO3, examDate: "2026-10-01", lang: "Arabic", format: "ONSITE_PROCTORED", company: "Masdar" },
    ],
  },
);

/* Invoices across the lifecycle, including one draft no partner may see. */
const invoiceSeed = [
  ["Level 1 cohort, May 2026", 12, 4800000, 1440000, "PAID", "TRF-88213"],
  ["Level 2 and CCIO, April 2026", 9, 5400000, 1800000, "PAID", "SEB-55190"],
  ["CCIO cohort, March 2026", 7, 6300000, 2100000, "PAYMENT_REPORTED", "ENBD-77410"],
  ["Catalyst cohort, June 2026", 5, 1500000, 600000, "SENT", null],
  ["Design Thinking L1, July 2026", 4, 1200000, 480000, "SENT", null],
  ["Level 1 cohort, July 2026", 6, 0, 0, "DRAFT", null],
];
invoiceSeed.forEach(([description, count, rev, gimi, status, ref], n) => {
  DB.invoices.push({
    id: "inv" + (n + 1),
    partnerId: active[n % active.length].id,
    description, studentCount: count,
    partnerRevenue: rev, gimiAmount: gimi, status,
    issuedAt: status === "DRAFT" ? null : "2026-06-20",
    dueDate: "2026-08-3" + (n % 2),
    pdf: status === "DRAFT" ? null : `GIMI-2026-0${20 + n}.pdf`,
    qbRef: status === "DRAFT" ? null : `QB-10${40 + n}`,
    payment: ref ? { reference: ref, paidOn: "2026-07-10", method: "Bank transfer" } : null,
  });
});

const leadSeed = [
  ["Abu Dhabi Ports", "Yasmine Haddad", "IN_DISCUSSION", "HIGH", "MET_IN_PERSON", "PROPOSAL", 9000000, "Co-branded proposal deck and a reference from a similar client."],
  ["Scania", "Johan Ek", "QUALIFIED", "MEDIUM", "INTRO_CALL", "OVERVIEW", 14000000, "Pricing for a 40-person cohort."],
  ["Dubai Chambers", "Layla Ahmed", "NEW", "LOW", "NOT_YET", "NOTHING", 5000000, "Introduction if GIMI has a contact."],
  ["Yayasan Inovasi Malaysia", "KC Teow", "QUALIFIED", "HIGH", "MET_IN_PERSON", "PRICING", 6000000, "Train-the-trainer schedule for Q4."],
  ["Codelco", "Pablo Reyes", "CLOSED", "MEDIUM", "INTRO_CALL", "OVERVIEW", 4000000, ""],
];
leadSeed.forEach(([company, contact, stage, prob, met, docs, rev, support], n) => {
  DB.leads.push({
    id: "l" + (n + 1),
    partnerId: active[n % active.length].id,
    company, contact, website: "", stage,
    probability: prob, metStatus: met, docsSent: docs,
    products: [pick(CERTIFICATIONS, n), pick(CERTIFICATIONS, n + 4)],
    expectedRevenue: rev,
    expectedCloseDate: n % 2 ? "2026-11-20" : null,
    supportNeeded: support,
    reviewed: n > 2,
  });
});

/* ----------------------------- recognition, using GIMI's real nomination text
   Taken from the "CTP of the Month" sheet, trimmed. A nomination belongs to
   the month being recognised, not the month it was collected. */
const byName = (needle) =>
  DB.partners.find((p) => p.name.toLowerCase().includes(needle.toLowerCase()))?.id;

const nominationSeed = [
  ["2026-07", byName("Easy Ltd"), byName("Clarus"), "Kicked off the year with the country's first Certified Innovation Professional training."],
  ["2026-07", byName("SIA Partners"), null, "Conducted three audits: Level 4 for Abu Dhabi Ports, Level 3 for Dubai Chambers, and Future Foresight Level 2."],
  ["2026-07", byName("Clarus"), byName("Clarus"), "Self-nominated: trained 4 teachers from Yayasan Inovasi Malaysia through the GIMI Impact TTT, who then piloted with 9 students."],
  ["2026-06", byName("IXL Colombia"), byName("SIA Partners"), "Paid for 117 Level 1 self-paced enrolments with UNAD."],
];
nominationSeed.forEach(([month, pid, byId, text], n) => {
  if (!pid) return;
  DB.nominations.push({
    id: "n" + (n + 1), month, partnerId: pid, byPartnerId: byId,
    text, status: month === "2026-06" ? "SELECTED" : "PENDING",
  });
});

[["2026-06", byName("IXL Colombia")], ["2026-05", byName("Apesoft")], ["2026-04", byName("IXL Center US")]]
  .forEach(([month, pid]) => { if (pid) DB.winners.push({ month, partnerId: pid }); });

/* One poll open, one closed, wording written by the admin and each option
   tagged to a real partner so the winner links to a record. */
const openOptions = [
  [byName("SIA Partners"), "SIA Partners: three audits completed, Level 4 for Abu Dhabi Ports, Level 3 for Dubai Chambers and Future Foresight Level 2.", 3],
  [byName("Clarus"), "Clarus Consulting: trained 4 teachers through the GIMI Impact TTT, who then piloted the programme with 9 students.", 2],
  [byName("Easy Ltd"), "Easy Ltd: delivered the country's first Certified Innovation Professional training.", 1],
].filter(([pid]) => pid);

DB.polls.push(
  {
    id: "poll1", month: "2026-07", status: "OPEN",
    question: "Who should be CTP of the Month for July 2026?",
    options: openOptions.map(([pid, label, votes], n) => ({ id: "o" + n, partnerId: pid, label, votes })),
    votedBy: [],
  },
  {
    id: "poll0", month: "2026-06", status: "CLOSED",
    question: "Who should be CTP of the Month for June 2026?",
    options: [
      { id: "z1", partnerId: byName("IXL Colombia"), label: "IXL Colombia: 117 Level 1 self-paced enrolments paid with UNAD.", votes: 6 },
      { id: "z2", partnerId: byName("SIA Partners"), label: "SIA Partners: two new audit engagements secured.", votes: 2 },
    ].filter((o) => o.partnerId),
    votedBy: [],
  },
);

DB.forum.push(
  { id: "f1", partnerId: active[1].id, author: active[1].users[0]?.name ?? "A partner", when: "2026-07-24", text: "Has anyone run CCIO with a public-sector cohort larger than 30?" },
  { id: "f2", partnerId: active[0].id, author: active[0].users[0]?.name ?? "A partner", when: "2026-07-25", text: "Yes, twice. Split them into two proctored rooms, it works better than one large hall." },
);

/* Whoever is signed in. The partner identity is the first active partner with
   a login, so the partner view is always populated. */
const demoPartner = active.find((p) => p.users.length > 0);

const IDENTITIES = {
  admin: { kind: "ADMIN", name: "GIMI Admin", email: "admin@giminstitute.org", partnerId: null },
  partner: {
    kind: "PARTNER",
    name: demoPartner.users[0].name,
    email: demoPartner.users[0].email,
    partnerId: demoPartner.id,
  },
};
