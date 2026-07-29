/* ===========================================================================
   Generated from two GIMI workbooks. Do not hand-edit; regenerate instead.

     GIMI CTP Strategy 2026.xlsx  ->  sheet "All Current CTPs"
     Courses LMS_2025-2026.xlsx   ->  sheet "Courses we should use 2025-2026"

   PUBLISHABLE VARIANT. Real company names, countries, regions and partner
   types only. Every personal name and email address has been replaced with a
   generic portal@ address, and GIMI's internal activity assessment has been
   removed. Safe to serve from a public URL.

   Deliberately NOT copied across: the royalty percentages, per-person prices
   and business-model columns from that sheet. The portal has no field for them,
   and CLAUDE.md forbids a percentage anywhere in the schema, the API or the UI.

   Regenerate both variants together; never edit one by hand.
   =========================================================================== */

const REAL_PARTNERS = [
  {
    "n": 1,
    "name": "SIA Partners",
    "country": "UAE",
    "region": "Middle East",
    "contactName": "",
    "contacts": [
      "portal@sia-partners.com"
    ],
    "activity": "",
    "type": "Consulting Partner"
  },
  {
    "n": 2,
    "name": "KACE",
    "country": "Jordan",
    "region": "Middle East",
    "contactName": "",
    "contacts": [
      "portal@kace.jo"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 3,
    "name": "UCOTRA",
    "country": "Morocco",
    "region": "North Africa",
    "contactName": "",
    "contacts": [
      "portal@ucotra.com"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 4,
    "name": "Innovety",
    "country": "Egypt",
    "region": "North Africa",
    "contactName": "",
    "contacts": [
      "portal@innovety.com"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 5,
    "name": "IXL Italy",
    "country": "Italy",
    "region": "Europe",
    "contactName": "",
    "contacts": [
      "portal@ixl-center.net"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 6,
    "name": "Innovate AS",
    "country": "Scandinavia",
    "region": "Europe",
    "contactName": "",
    "contacts": [
      "portal@digitalinsight.no"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 8,
    "name": "Grupo Alva",
    "country": "Portugal",
    "region": "Europe",
    "contactName": "",
    "contacts": [
      "portal@alva-rc.com"
    ],
    "activity": "",
    "type": "Content Partner"
  },
  {
    "n": 9,
    "name": "Qmanagement",
    "country": "Netherland",
    "region": "Europe",
    "contactName": "",
    "contacts": [
      "portal@qmanagement.nl"
    ],
    "activity": "",
    "type": "Sales Partner"
  },
  {
    "n": 10,
    "name": "Easy Ltd",
    "country": "Nigeria",
    "region": "West, East, South Africa",
    "contactName": "",
    "contacts": [
      "portal@easydataltd.com"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 11,
    "name": "Earn International",
    "country": "South Africa",
    "region": "West, East, South Africa",
    "contactName": "",
    "contacts": [
      "portal@earninternational.net"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 12,
    "name": "FES Consulting",
    "country": "Ghana",
    "region": "West, East, South Africa",
    "contactName": "",
    "contacts": [
      "portal@modernworldlogistics.com"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 13,
    "name": "Doracrea",
    "country": "Mauritius",
    "region": "West, East, South Africa",
    "contactName": "",
    "contacts": [
      "portal@doracrea.com"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 14,
    "name": "TDM Internacional",
    "country": "Mexico",
    "region": "North America",
    "contactName": "",
    "contacts": [
      "portal@tdminternacional.com"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 15,
    "name": "IXL Center US",
    "country": "US",
    "region": "North America",
    "contactName": "",
    "contacts": [
      "portal@ixl-center.net"
    ],
    "activity": "",
    "type": "Consulting Partner"
  },
  {
    "n": 16,
    "name": "Innavise",
    "country": "Bermuda",
    "region": "South America",
    "contactName": "",
    "contacts": [
      "portal@innavise.com"
    ],
    "activity": "",
    "type": "Sales Partner"
  },
  {
    "n": 17,
    "name": "Apesoft",
    "country": "Peru",
    "region": "South America",
    "contactName": "",
    "contacts": [
      "portal@smartconnections.biz"
    ],
    "activity": "",
    "type": "Sales Partner"
  },
  {
    "n": 18,
    "name": "IXL Brazil",
    "country": "Brazil",
    "region": "South America",
    "contactName": "",
    "contacts": [
      "portal@ixl-center.net"
    ],
    "activity": "",
    "type": "Consulting Partner"
  },
  {
    "n": 19,
    "name": "IXL Colombia",
    "country": "Colombia",
    "region": "South America",
    "contactName": "",
    "contacts": [
      "portal@ixl-center.net"
    ],
    "activity": "",
    "type": "Consulting Partner"
  },
  {
    "n": 20,
    "name": "Sandbox",
    "country": "El Salvador",
    "region": "South America",
    "contactName": "",
    "contacts": [
      "portal@innbox.sv"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 21,
    "name": "Wholistic Institute of Lifelong Learning",
    "country": "Singapore",
    "region": "Asia",
    "contactName": "",
    "contacts": [
      "portal@singnet.com.sg"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 22,
    "name": "Clarus Consulting",
    "country": "Malaysia",
    "region": "Asia",
    "contactName": "",
    "contacts": [
      "portal@clarus.my"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 23,
    "name": "Embiggen Consulting",
    "country": "Philippines",
    "region": "Asia",
    "contactName": "",
    "contacts": [
      "portal@embiggenconsulting.com"
    ],
    "activity": "",
    "type": "Audit Partner"
  },
  {
    "n": 24,
    "name": "SBM-ITB",
    "country": "Indonesia",
    "region": "Asia",
    "contactName": "",
    "contacts": [
      "portal@sbm-itb.ac.id"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 25,
    "name": "AtoZ decisions",
    "country": "Kazakhistan",
    "region": "Asia",
    "contactName": "",
    "contacts": [
      "portal@gmail.com"
    ],
    "activity": "",
    "type": "Sales Partner"
  },
  {
    "n": 26,
    "name": "Hong Kong Innovation Management Institute",
    "country": "Hong Kong and China",
    "region": "Asia",
    "contactName": "",
    "contacts": [
      "portal@innoedge.com.hk"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 27,
    "name": "IXL Korea",
    "country": "Korea",
    "region": "Asia",
    "contactName": "",
    "contacts": [
      "portal@ixlkorea.co.kr"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 28,
    "name": "Sira Innovation",
    "country": "Japan",
    "region": "Asia",
    "contactName": "",
    "contacts": [
      "portal@sirainnovation.com"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 29,
    "name": "Exceed Beyond",
    "country": "India",
    "region": "Asia",
    "contactName": "",
    "contacts": [
      "portal@xceedbeyond.com"
    ],
    "activity": "",
    "type": "Sales Partner"
  },
  {
    "n": 30,
    "name": "Prashant Nasery",
    "country": "India",
    "region": "Asia",
    "contactName": "",
    "contacts": [
      "portal@focusengineering.in"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 31,
    "name": "Triangle Partners",
    "country": "Australia",
    "region": "Asia",
    "contactName": "",
    "contacts": [
      "portal@trianglepartners.com.au"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 32,
    "name": "Kavoo Agency",
    "country": "Kenya",
    "region": "Africa",
    "contactName": "",
    "contacts": [
      "portal@gmail.com"
    ],
    "activity": "",
    "type": "Training Partner"
  },
  {
    "n": 33,
    "name": "Optimus",
    "country": "",
    "region": "",
    "contactName": "",
    "contacts": [
      "portal@optimustrust.com"
    ],
    "activity": "",
    "type": "Consulting Partner"
  }
];

const COURSE_CATALOGUE = [
  {
    "label": "LEVEL 1 ASSOCIATE",
    "number": "143",
    "title": "GIMI ASSOCIATE COURSE 2025",
    "link": "https://certifications.giminstitute.org/course/view.php?id=143"
  },
  {
    "label": "LEVEL 2 MASTER",
    "number": "133",
    "title": "GIMI COURSE: MASTER (LEVEL 2) ENGLISH",
    "link": "https://certifications.giminstitute.org/course/view.php?id=133"
  },
  {
    "label": "LEVEL 3 MANAGER",
    "number": "122",
    "title": "GIMI COURSE LEVEL 3 MANAGER",
    "link": "https://certifications.giminstitute.org/course/view.php?id=122"
  },
  {
    "label": "FF Level 3",
    "number": "220",
    "title": "Future Foresight L3 Certification",
    "link": "https://certifications.giminstitute.org/course/view.php?id=220"
  },
  {
    "label": "Leader of the future",
    "number": "",
    "title": "Leader of the future",
    "link": "https://certifications.giminstitute.org/course/view.php?id=179&section=11#tabs-tree-start"
  },
  {
    "label": "Design Thinking",
    "number": "240",
    "title": "COMPLETE GUIDE TO DESIGN THINKING - Level 1",
    "link": "https://certifications.giminstitute.org/course/view.php?id=240"
  },
  {
    "label": "Design Thinking L2",
    "number": "263",
    "title": "COMPLETE GUIDE TO DESIGN THINKING - Level 2",
    "link": "https://certifications.giminstitute.org/course/view.php?id=263"
  },
  {
    "label": "Longevity",
    "number": "324",
    "title": "Longevity",
    "link": "https://certifications.giminstitute.org/course/view.php?id=324"
  },
  {
    "label": "Primer",
    "number": "193",
    "title": "Innovation Primer",
    "link": "https://certifications.giminstitute.org/course/view.php?id=193"
  },
  {
    "label": "Technovate",
    "number": "323",
    "title": "Technovate",
    "link": "https://certifications.giminstitute.org/course/view.php?id=323"
  }
];

const EXAM_CATALOGUE = [
  {
    "label": "LEVEL 1 ASSOCIATE",
    "number": "",
    "title": "V2 GIM Institute: Level One (Associate) Certification Exam",
    "link": "https://certifications.giminstitute.org/course/section.php?id=3273"
  },
  {
    "label": "LEVEL 3 MANAGER",
    "number": "103",
    "title": "GIM Institute: Level Three (Manager) Certification Exam",
    "link": "https://certifications.giminstitute.org/course/view.php?id=103"
  },
  {
    "label": "FF Level 1",
    "number": "139",
    "title": "Future Foresight L1 Certification Exam",
    "link": "https://certifications.giminstitute.org/course/view.php?id=139"
  },
  {
    "label": "FF Level 2",
    "number": "217",
    "title": "Future Foresight L2 Certification Exam",
    "link": "https://certifications.giminstitute.org/course/view.php?id=217"
  },
  {
    "label": "FF Level 3",
    "number": "103",
    "title": "Future Foresight L3 Certification Exam",
    "link": "https://certifications.giminstitute.org/course/view.php?id=220"
  },
  {
    "label": "Design Thinking",
    "number": "255",
    "title": "Certification - Design Thinking Level 1",
    "link": "https://certifications.giminstitute.org/course/view.php?id=255"
  }
];

const CERTIFICATIONS = [
  "Innovation Potential Assessment (IPA)",
  "Level 1 Associate",
  "Level 2 Master",
  "Level 3 Manager",
  "Level 4 Audit",
  "Future Foresight Level 1",
  "Future Foresight Level 2",
  "Future Foresight Level 3",
  "Design Thinking Level 1",
  "Design Thinking Level 2",
  "Certified Innovation Professional (CIP)",
  "Certified Chief Innovation Officer (CCIO)",
  "Innovation Catalyst",
  "Leader of the Future",
  "Innovation Primer",
  "Longevity",
  "Technovate"
];
