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

const slug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* Live LMS course pages, supplied by GIMI on 30 July 2026.
   Four have no course yet and render as plain text rather than a broken link.
   Two things worth knowing, both flagged back to GIMI:
     - "Certified Leader for the Future" points at 475, the same course as
       "Certified Innovation Leader". One of the two is probably wrong.
     - "Certified GIMI Impact: Teachers" was given two courses, 363 and 364.
       The first is used here. */
const LMS = "https://certifications.giminstitute.org/course/view.php?id=";
const LMS_LINKS = {
  "Primer": LMS + "474&section=6#tabs-tree-start",
  "Certified Innovation Leader": LMS + "475",
  "Certified Innovation Professional Level 0: Innovation Champion": LMS + "429",
  "Problem Solving Certified Catalyst": LMS + "521",
  "Certified Innovation Professional Level 1: Associate": LMS + "491",
  "Certified Innovation Professional Level 2: Master": LMS + "352",
  "Certified Chief Innovation Officer Level 3: Manager": LMS + "480",
  "Certified Chief Innovation Officer Level 4: Leader": LMS + "354",
  "Certified Foresight Professional: Level 1": LMS + "503",
  "Certified Foresight Leader: Level 2": LMS + "217",
  "Certified Foresight Officer: Level 3": LMS + "220",
  // Certified Trainer In Future Foresight Level 1 — no course yet
  // Certified Trainer In Future Foresight Level 2 — no course yet
  "Certified Design Thinking: Level 1": LMS + "523",
  "Certified Design Thinking: Level 2": LMS + "263",
  "Certified Design Thinking Trainer": LMS + "298",
  "Certified ISO Innovation Management Expert": LMS + "508",
  "Certified Technology Catalyst": LMS + "323",
  "Certified Longevity Catalyst": LMS + "324",
  "Certified GIMI Impact: Students": LMS + "366",
  "Certified GIMI Impact: Teachers": LMS + "363",
  "Certified GIMI Trainer": LMS + "303",
  "Certified Leader for the Future": LMS + "475",
  "Certified GIMI Auditor": LMS + "306",
  "Certified Management Consulting Level 1: Analyst": LMS + "113",
  "Certified Management Consulting Level 2: Consultant": LMS + "145",
  // Certified Management Consulting Level 3: Manager — no course yet
  // Certified Management Consulting Level 4: Leader — no course yet
  "Certified AI Agent Practitioner": LMS + "537&section=4",
};

/* There is no approval step. GIMI decides who to invite; sending the invitation IS
   the decision. A partner is INVITED until they complete their own details, at which
   point they are ACTIVE and appear in the main table. Nothing to approve afterwards.

   Every real partner is ACTIVE. "New partner" in GIMI's sheet is how engaged they
   are, not a portal state, so it must never become one. Two invented partners carry
   the invited state, so no real company is published as not-yet-joined.

   Nothing about the demo's shape may depend on `activity`: that field is stripped
   from the published build, and when the shape depended on it the live site silently
   lost its queue and its partner directory. */
const DEMO_INVITED = [
  {
    name: "Andes Example Institute", country: "Chile", region: "South America",
    type: "Training Partner", inviteEmail: "director@example-institute.cl",
    sentAt: "2026-07-24", expiresAt: "2026-07-31",
  },
  {
    name: "Baltic Example Forum", country: "Estonia", region: "Europe",
    type: "Training Partner", inviteEmail: "director@example-forum.ee",
    sentAt: "2026-07-26", expiresAt: "2026-08-02",
  },
];

/* ------------------------------------------------------------------ build */

const DB = {
  settings: { leaderboardEnabled: false },

  /* Admin-only columns, all of them managed from the Partners tab: add, rename and
     remove. "Last met" and "Next steps" are seeded because GIMI asked for them, but
     they are ordinary columns with no special handling, which is the point. The
     activity assessment only appears when the data holds it, so the published build
     shows no empty column. */
  customColumns: [
    ...(REAL_PARTNERS.some((r) => r.activity) ? [{ id: 1, name: "Activity", position: 1 }] : []),
    { id: 2, name: "Last met", position: 2 },
    { id: 3, name: "Next steps", position: 3 },
    { id: 4, name: "Internal note", position: 4 },
  ],
  nextColumnId: 5,

  partners: [
    ...REAL_PARTNERS.map((r, index) => ({
      // Derived from position, not from a field in the generated file. It was built
      // from a row number once, the generator stopped emitting it, and every partner
      // silently became "pundefined" — which made every partner-scoped filter return
      // the whole network.
      id: "p" + (index + 1),
      name: r.name,
      country: r.country || "—",
      region: r.region || "—",
      partnerType: r.type || "—",
      status: "ACTIVE",
      website: r.contacts[0] ? r.contacts[0].split("@")[1] : "",
      linkedin: "",
      phone: "",
      // Not supplied in the workbook. Left null rather than invented, so nobody
      // mistakes a made-up target for a real one.
      expectedRevenue: null,
      // A partner's own choice, so spread rather than tied to anything real.
      visibleInDirectory: index % 3 !== 2,
      createdAt: `202${4 + (index % 2)}-0${(index % 9) + 1}-1${index % 9}`,
      approvedAt: `202${4 + (index % 2)}-0${(index % 9) + 1}-2${index % 8}`,
      users: r.contacts.map((email, n) => ({
        name: n === 0 ? r.contactName || email.split("@")[0] : email.split("@")[0],
        email,
        lastLogin: index % 4 === 3 ? null : `2026-0${(index % 7) + 1}-1${index % 9}`,
      })),
      notes: {
        1: r.activity,
        2: `2026-0${(index % 6) + 1}-1${index % 9}`,
        3: index % 4 === 0 ? "Send Q4 cohort pricing" : index % 4 === 1 ? "Follow up on renewal" : "",
        4: "",
      },
      comments: index % 5 === 0
        ? [{ when: "2026-06-18", author: "GIMI Admin", text: "Strong delivery this quarter. Asked for co-branded material for the next cohort." }]
        : [],
    })),
    ...DEMO_INVITED.map((d, n) => ({
      id: "invited" + (n + 1),
      name: d.name,
      country: d.country,
      region: d.region,
      partnerType: d.type,
      status: "INVITED",
      website: "", linkedin: "", phone: "",
      expectedRevenue: null,
      visibleInDirectory: false,
      createdAt: d.sentAt,
      approvedAt: null,
      users: [], // Nobody until they complete their own details.
      notes: { 1: "", 2: "", 3: "", 4: "" },
      comments: [],
    })),
  ],

  invites: DEMO_INVITED.map((d, n) => ({
    id: "i" + (n + 1),
    partnerId: "invited" + (n + 1),
    email: d.inviteEmail,
    sentAt: d.sentAt,
    expiresAt: d.expiresAt,
  })),
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
  catalogue: CATALOGUE.map((c) => ({ ...c, lmsLink: LMS_LINKS[c.name] ?? null })),

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
      // Spread across two years so the year filter has something to do.
      examDate: `${sid % 3 === 0 ? 2025 : 2026}-0${(sid % 9) + 1}-1${sid % 9}`,
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

/* Invoices across the lifecycle and across two years, including one draft that no
   partner may see.
     description, headcount, partnerRevenue, gimiAmount, status, bank ref, year
   Partner revenue is the headcount times the catalogue certificate price, which is
   what the figure means. The GIMI amount is a plausible negotiated number and is
   NOT a fixed proportion of it: the last row is a student cohort at half price,
   and the second is a partner GIMI charges less. That variation is the reason the
   product refuses to derive one figure from the other. */
const invoiceSeed = [
  //                                                                    12 × $560
  ["Level 1 Associate cohort, May 2026", 12, 672000, 403200, "PAID", "TRF-88213", 2026],
  ["Level 2 Master cohort, April 2026", 9, 504000, 252000, "PAID", "SEB-55190", 2026],
  ["CCIO Level 3 cohort, March 2026", 7, 392000, 235200, "PAYMENT_REPORTED", "ENBD-77410", 2026],
  ["Catalyst cohort, June 2026", 5, 100000, 60000, "SENT", null, 2026],
  ["Design Thinking Level 1, July 2026", 4, 164000, 82000, "SENT", null, 2026],
  ["Level 1 Associate cohort, July 2026", 6, 0, 0, "DRAFT", null, 2026],
  ["Level 1 Associate cohort, October 2025", 18, 1008000, 604800, "PAID", "TRF-70118", 2025],
  ["Foresight Level 1, November 2025", 6, 336000, 201600, "PAID", "SEB-41902", 2025],
  ["GIMI Impact Students, September 2025", 22, 220000, 110000, "PAID", "ENBD-38771", 2025],
];
invoiceSeed.forEach(([description, count, rev, gimi, status, ref, year], n) => {
  DB.invoices.push({
    id: "inv" + (n + 1),
    partnerId: active[n % active.length].id,
    description, studentCount: count,
    partnerRevenue: rev, gimiAmount: gimi, status,
    issuedAt: status === "DRAFT" ? null : `${year}-0${(n % 9) + 1}-20`,
    dueDate: `${year}-1${n % 2}-15`,
    pdf: status === "DRAFT" ? null : `GIMI-${year}-0${20 + n}.pdf`,
    qbRef: status === "DRAFT" ? null : `QB-10${40 + n}`,
    payment: ref ? { reference: ref, paidOn: `${year}-1${n % 2}-10`, method: "Bank transfer" } : null,
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
    products: [pick(ENROLLABLE, n), pick(ENROLLABLE, n + 4)],
    expectedRevenue: rev,
    // When the partner shared it, so the year filter reaches leads too.
    submittedAt: `${n === 4 ? 2025 : 2026}-0${(n % 7) + 1}-1${n}`,
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
