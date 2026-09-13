// Computes all ten Part 2 answers from the raw downloaded datasets.
// Run: node analysis/scripts/answers.js
// Writes analysis/results/answers.json (not gitignored — contains no
// secrets, only derived statistics) for review and for submission.json.
"use strict";

const fs = require("fs");
const path = require("path");
const { loadListings, loadRentals, loadProjects } = require("./lib/load-data.js");
const { findCorruptListingIds } = require("./lib/corrupt-listings.js");
const { findFakeListingIds } = require("./lib/fake-listings.js");
const { findDuplicateProperties } = require("./lib/duplicate-properties.js");

// .env.local isn't loaded by load-data.js; client.js does that as a side
// effect and is required here only to get IVY_ASSIGNED_LOCALITY into env.
require("./client.js");

const REFERENCE_IST = "2026-09-10T00:00:00"; // naive IST wall-clock, see Q8 timezone finding
const SEVEN_DAYS_BEFORE_IST = "2026-09-03T00:00:00";

function main() {
  const listings = loadListings().results;
  const rentals = loadRentals().results;
  const projects = loadProjects().results;

  // --- Q1: total_listing_records ---
  // The API's `total` field is confirmed unreliable (undercounts by ~9-10%
  // on every collection endpoint — see INVESTIGATION_LOG.md). The true
  // count is the number of records actually reachable by paging with
  // offset/limit to has_more:false, verified reproducible across two
  // independent full downloads with zero duplicate IDs.
  const total_listing_records = listings.length;

  // --- Q2: unique_properties ---
  const { pairs: dupPairs, duplicateReduction } = findDuplicateProperties(listings);
  const unique_properties = total_listing_records - duplicateReduction;

  // --- Q3: active_listings ---
  const active_listings = listings.filter((l) => l.is_live === true).length;

  // --- Q4: corrupt_listing_ids ---
  const { ids: corruptIds, categories: corruptCategories } = findCorruptListingIds(listings);
  const corrupt_listing_ids = [...corruptIds].sort();

  // --- Q5: total_monthly_rent (assigned locality) ---
  const assignedLocality = (process.env.IVY_ASSIGNED_LOCALITY || "").toLowerCase().trim();
  const rentalsInLocality = rentals.filter((r) => r.locality === assignedLocality);
  const total_monthly_rent = rentalsInLocality.reduce((sum, r) => sum + r.price, 0);

  // --- Q9: fake_listing_ids ---
  const { ids: fakeIds } = findFakeListingIds(listings);
  const fake_listing_ids = [...fakeIds].sort();

  // --- Q6: avg_price_per_sqft_2bhk ---
  const excluded = new Set([...corruptIds, ...fakeIds]);
  const q6Eligible = listings.filter((l) => l.is_live === true && l.bedroom === 2 && !excluded.has(l.listing_id));
  const pricePerSqft = q6Eligible.map((l) => l.price / l.carpet_area);
  const avg_price_per_sqft_2bhk = +(pricePerSqft.reduce((a, b) => a + b, 0) / pricePerSqft.length).toFixed(2);

  // --- Q7: costliest_project ---
  // price_max is in mixed Indian Lakh/Crore display units, not raw rupees
  // (see INVESTIGATION_LOG.md "Units — project price_min/price_max").
  // load-data.js's loadProjects() applies the proven conversion.
  const costliestProject = projects.reduce((best, p) => (p.price_max_inr > best.price_max_inr ? p : best));
  const costliest_project = { project_id: costliestProject.project_id, price_max_inr: costliestProject.price_max_inr };

  // --- Q8: listings_last_7_days ---
  // listings.posted_at is naive local IST (proven via generation-cutoff
  // cross-check against rentals' known-UTC posted_at — both cut off exactly
  // at REFERENCE). No timezone conversion needed: compare the naive strings
  // directly against the naive IST interval boundaries.
  const listings_last_7_days = listings.filter(
    (l) => l.posted_at >= SEVEN_DAYS_BEFORE_IST && l.posted_at < REFERENCE_IST
  ).length;

  // --- Q10: projects_with_wrong_listing_count ---
  const countByProject = {};
  for (const l of listings) if (l.project_id) countByProject[l.project_id] = (countByProject[l.project_id] || 0) + 1;
  const projects_with_wrong_listing_count = projects.filter(
    (p) => (countByProject[p.project_id] || 0) !== p.total_listings
  ).length;

  const answers = {
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

  console.log(JSON.stringify(answers, null, 2));

  const outDir = path.join(__dirname, "..", "results");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "answers.json"),
    JSON.stringify(
      {
        computed_at: new Date().toISOString(),
        assigned_locality_used: assignedLocality,
        dataset_sizes: { listings: listings.length, rentals: rentals.length, projects: projects.length },
        answers,
        supporting_detail: {
          q2_duplicate_pairs_found: dupPairs.length,
          q4_category_counts: Object.fromEntries(Object.entries(corruptCategories).map(([k, v]) => [k, v.length])),
          q6_eligible_count: q6Eligible.length,
          q6_excluded_count: excluded.size,
        },
      },
      null,
      2
    )
  );
  console.log(`\nWrote ${path.join(outDir, "answers.json")}`);
}

main();
