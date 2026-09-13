// Investigates what /v1/projects price_min / price_max actually represent,
// by joining each project to its real listings (client-side — the
// `project_id` filter on /v1/listings is silently ignored, confirmed in
// Phase B) and comparing against the project's declared price_min/price_max.
"use strict";

const fs = require("fs");
const path = require("path");

const listings = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "raw", "listings.json"), "utf8")).results;
const projects = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "raw", "projects.json"), "utf8")).results;

const listingsByProject = new Map();
for (const l of listings) {
  if (!l.project_id) continue;
  if (!listingsByProject.has(l.project_id)) listingsByProject.set(l.project_id, []);
  listingsByProject.get(l.project_id).push(l);
}

const LAKH = 100000;
const CRORE = 10000000;

const ratios = { min: [], max: [] };
const rows = [];

for (const p of projects) {
  const ls = listingsByProject.get(p.project_id);
  if (!ls || ls.length < 3) continue; // need enough listings to trust the min/max bound
  const prices = ls.map((l) => l.price);
  const actualMin = Math.min(...prices);
  const actualMax = Math.max(...prices);

  const ratioMin = actualMin / p.price_min;
  const ratioMax = actualMax / p.price_max;
  ratios.min.push(ratioMin);
  ratios.max.push(ratioMax);
  rows.push({
    project_id: p.project_id,
    n_listings: ls.length,
    price_min_raw: p.price_min,
    price_max_raw: p.price_max,
    actual_min_listing_price: actualMin,
    actual_max_listing_price: actualMax,
    ratio_min: ratioMin,
    ratio_max: ratioMax,
  });
}

console.log(`Projects with >=3 matching listings: ${rows.length} / ${projects.length}`);

function bucketize(values, label) {
  const nearLakh = values.filter((r) => Math.abs(r - LAKH) / LAKH < 0.3).length;
  const nearCrore = values.filter((r) => Math.abs(r - CRORE) / CRORE < 0.3).length;
  const other = values.length - nearLakh - nearCrore;
  console.log(`${label}: near LAKH(1e5)=${nearLakh}, near CRORE(1e7)=${nearCrore}, other=${other} (n=${values.length})`);
}

bucketize(ratios.min, "ratio_min (actual_min_listing_price / price_min_raw)");
bucketize(ratios.max, "ratio_max (actual_max_listing_price / price_max_raw)");

console.log("\nSample rows sorted by price_min_raw:");
rows
  .sort((a, b) => a.price_min_raw - b.price_min_raw)
  .slice(0, 15)
  .forEach((r) => console.log(JSON.stringify(r)));

console.log("\nSample rows with price_min_raw >= 50:");
rows
  .filter((r) => r.price_min_raw >= 50)
  .slice(0, 10)
  .forEach((r) => console.log(JSON.stringify(r)));

console.log("\nSample rows with price_min_raw < 10:");
rows
  .filter((r) => r.price_min_raw < 10)
  .slice(0, 10)
  .forEach((r) => console.log(JSON.stringify(r)));

fs.writeFileSync(path.join(__dirname, "..", "raw", "_price_unit_rows.json"), JSON.stringify(rows, null, 2));
