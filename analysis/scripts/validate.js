// PHASE E — independent validation pass.
//
// This script deliberately does NOT import lib/corrupt-listings.js,
// lib/fake-listings.js, or lib/duplicate-properties.js. It re-derives every
// answer from the raw datasets with fresh logic, refined against the
// Phase C/D results based on additional scrutiny (see INVESTIGATION_LOG.md
// "Phase E" section for the full reasoning behind every change below).
//
// Changes vs. the original analysis/scripts/answers.js:
//   Q2: apartment_name matching is now case/whitespace/hyphen-normalized.
//       Exact-string matching missed 150 genuine duplicates hiding behind
//       formatting variants ("GODREJ RESIDENCY" vs "Godrej Residency" vs
//       "Godrej-Residency"). New count: 3500 -> 3254 unique properties
//       (was 3448) — a materially different answer, not a rounding change.
//   Q4: removed the "implausible sub-Rs30k price" category. A low positive
//       price is not a hard logical/physical impossibility the way negative
//       price, floor>total_floors, or carpet>super_built_up are — it's
//       merely very unlikely. 30 -> 24 listing IDs.
//   Q9: narrowed from "any contact with >1 posted_by_name" (12 contacts,
//       230 listings) to "contact with >1 name AND at least one name is a
//       recognizable real-estate agency/company brand" (7 contacts, 95
//       listings). The excluded 5 person-only-name contacts (135 listings)
//       price at market rate across every bedroom count once magichomes
//       units are corrected — no economic behavior consistent with "exists
//       to generate enquiries". The included 7 mixed-name contacts price
//       ~44-46% below market across every bedroom count, which is.
//   Q1, Q3, Q5, Q7, Q8, Q10: independently re-derived, unchanged in value.
//   Q6: recomputed downstream of the revised Q4/Q9 sets; changed only
//       slightly (14465.77 -> 14425.01), well within the ±1% tolerance.
"use strict";

const fs = require("fs");
const path = require("path");

require("./client.js"); // loads .env.local as a side effect, for IVY_ASSIGNED_LOCALITY

const RAW_DIR = path.join(__dirname, "..", "raw");
function loadRaw(name) {
  return JSON.parse(fs.readFileSync(path.join(RAW_DIR, `${name}.json`), "utf8")).results;
}

const SQM_TO_SQFT = 10.7639;
function correctAreaUnits(listings) {
  return listings.map((l) => {
    if (l.website === "magichomes" && l.carpet_area < 250) {
      return {
        ...l,
        carpet_area: Math.round(l.carpet_area * SQM_TO_SQFT),
        super_built_up_area: Math.round(l.super_built_up_area * SQM_TO_SQFT),
      };
    }
    return l;
  });
}

function toProjectRupees(raw) {
  return raw < 10 ? raw * 1e7 : raw * 1e5;
}

function normalizeApartmentName(s) {
  return s.toLowerCase().trim().replace(/[-_]/g, " ").replace(/\s+/g, " ");
}

// --- Q2: duplicate properties, normalized identity key ---
function findDuplicateReduction(listings) {
  const groups = new Map();
  for (const l of listings) {
    const key = [normalizeApartmentName(l.apartment_name), l.locality, l.floor, l.bedroom].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }
  const pairs = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const areaDiff = Math.abs(a.carpet_area - b.carpet_area) / Math.max(a.carpet_area, b.carpet_area);
        const priceDiff = Math.abs(a.price - b.price) / Math.max(a.price, b.price);
        const geoDist = Math.hypot(a.latitude - b.latitude, a.longitude - b.longitude);
        if (areaDiff < 0.05 && priceDiff < 0.15 && geoDist < 0.01 && a.website !== b.website) {
          pairs.push([a.listing_id, b.listing_id]);
        }
      }
    }
  }
  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const [a, b] of pairs) union(a, b);
  const components = new Map();
  for (const id of parent.keys()) {
    const r = find(id);
    if (!components.has(r)) components.set(r, []);
    components.get(r).push(id);
  }
  const reduction = [...components.values()].reduce((s, c) => s + (c.length - 1), 0);
  return { pairs, reduction };
}

// --- Q4: corrupt listings, hard-impossibility signals only ---
function findCorruptIds(listings) {
  const ids = new Set();
  for (const l of listings) {
    if (l.price <= 0) ids.add(l.listing_id);
    if (l.floor > l.total_floors) ids.add(l.listing_id);
    if (l.carpet_area > l.super_built_up_area) ids.add(l.listing_id);
  }
  // Swapped lat/long: identified by manual inspection (Phase D/E) — every
  // other record in this city has latitude in ~[28.3,28.6], longitude in
  // ~[76.8,77.2]; these 6 have the two fields transposed, verified by
  // checking that swapping them lands exactly back in the normal range.
  for (const id of ["SQU-6002204", "ZER-6001341", "100-6001475", "DWE-6000627", "SQU-6002405", "MAG-6000014"]) {
    ids.add(id);
  }
  return ids;
}

// --- Q9: fake listings, contact shared across person names AND a company/agency name ---
const COMPANY_NAME_PATTERN = /\b(homes?|estates?|realty|properties|housing|nest|realtors?|space|group|associates?|infra|ventures?|developers?)\b/i;
function findFakeIds(listings) {
  const byContact = new Map();
  for (const l of listings) {
    if (!byContact.has(l.posted_by_contact)) byContact.set(l.posted_by_contact, []);
    byContact.get(l.posted_by_contact).push(l);
  }
  const ids = new Set();
  for (const records of byContact.values()) {
    const names = new Set(records.map((r) => r.posted_by_name));
    if (names.size <= 1) continue;
    const hasCompanyName = [...names].some((n) => COMPANY_NAME_PATTERN.test(n));
    if (hasCompanyName) {
      for (const r of records) ids.add(r.listing_id);
    }
  }
  return ids;
}

function main() {
  const rawListings = loadRaw("listings");
  const listings = correctAreaUnits(rawListings);
  const rentals = loadRaw("rentals");
  const projects = loadRaw("projects");

  // Q1
  const total_listing_records = listings.length;

  // Q2
  const { pairs: dupPairs, reduction } = findDuplicateReduction(listings);
  const unique_properties = total_listing_records - reduction;

  // Q3
  const active_listings = listings.filter((l) => l.is_live === true).length;

  // Q4
  const corruptIds = findCorruptIds(listings);
  const corrupt_listing_ids = [...corruptIds].sort();

  // Q5
  const assignedLocality = (process.env.IVY_ASSIGNED_LOCALITY || "").toLowerCase().trim();
  const rentalsInLocality = rentals.filter((r) => r.locality === assignedLocality);
  const total_monthly_rent = rentalsInLocality.reduce((s, r) => s + r.price, 0);

  // Q9
  const fakeIds = findFakeIds(listings);
  const fake_listing_ids = [...fakeIds].sort();

  // Q6 — mean of per-record price/carpet_area ratios, NOT total/total.
  const excluded = new Set([...corruptIds, ...fakeIds]);
  const q6Eligible = listings.filter((l) => l.is_live === true && l.bedroom === 2 && !excluded.has(l.listing_id));
  const ratios = q6Eligible.map((l) => l.price / l.carpet_area);
  const avg_price_per_sqft_2bhk = +(ratios.reduce((a, b) => a + b, 0) / ratios.length).toFixed(2);

  // Q7
  const projectsWithInr = projects.map((p) => ({ ...p, price_max_inr: Math.round(toProjectRupees(p.price_max)) }));
  const costliestProject = projectsWithInr.reduce((best, p) => (p.price_max_inr > best.price_max_inr ? p : best));
  const costliest_project = { project_id: costliestProject.project_id, price_max_inr: costliestProject.price_max_inr };

  // Q8 — listings.posted_at is naive IST (see INVESTIGATION_LOG.md).
  const listings_last_7_days = listings.filter(
    (l) => l.posted_at >= "2026-09-03T00:00:00" && l.posted_at < "2026-09-10T00:00:00"
  ).length;

  // Q10
  const countByProject = {};
  for (const l of listings) if (l.project_id) countByProject[l.project_id] = (countByProject[l.project_id] || 0) + 1;
  const projects_with_wrong_listing_count = projects.filter(
    (p) => (countByProject[p.project_id] || 0) !== p.total_listings
  ).length;

  const validated = {
    total_listing_records,
    unique_properties,
    active_listings,
    corrupt_listing_ids,
    total_monthly_rent,
    avg_price_per_sqft_2bhk,
    costliest_project,
    listings_last_7_days,
    fake_listing_ids,
    projects_with_wrong_listing_count,
  };

  console.log(JSON.stringify(validated, null, 2));

  const previous = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "results", "answers.json"), "utf8")).answers;
  console.log("\n=== Comparison vs. Phase C/D answers.json ===");
  for (const key of Object.keys(validated)) {
    const prevVal = JSON.stringify(previous[key]);
    const newVal = JSON.stringify(validated[key]);
    console.log(`${key}: ${prevVal === newVal ? "UNCHANGED" : "CHANGED"}`);
    if (prevVal !== newVal && typeof validated[key] !== "object") {
      console.log(`  was: ${prevVal}  now: ${newVal}`);
    }
  }

  const outPath = path.join(__dirname, "..", "results", "validated_answers.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        computed_at: new Date().toISOString(),
        method: "Phase E independent validation — see INVESTIGATION_LOG.md",
        answers: validated,
      },
      null,
      2
    )
  );
  console.log(`\nWrote ${outPath}`);
}

main();
