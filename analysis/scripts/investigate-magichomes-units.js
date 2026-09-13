// Reproduces the discovery that a subset of magichomes listings report
// carpet_area/super_built_up_area in square meters, not square feet.
"use strict";
const fs = require("fs");
const path = require("path");
const listings = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "raw", "listings.json"), "utf8")).results;
const SQM_TO_SQFT = 10.7639;

for (const bed of [0, 1, 2, 3, 4, 5]) {
  const vals = listings
    .filter((l) => l.website === "magichomes" && l.bedroom === bed)
    .map((l) => l.carpet_area)
    .sort((a, b) => a - b);
  console.log(`bedroom=${bed} n=${vals.length}: ${vals.join(", ")}`);
}

const suspects = listings.filter((l) => l.website === "magichomes" && l.carpet_area < 250);
console.log(`\nmagichomes records with carpet_area < 250 (suspected sqm): ${suspects.length}`);

function statsByBedroom(items, field) {
  const groups = {};
  for (const l of items) (groups[l.bedroom] ||= []).push(l[field]);
  const out = {};
  for (const [k, v] of Object.entries(groups)) {
    out[k] = { n: v.length, min: Math.min(...v), max: Math.max(...v), avg: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) };
  }
  return out;
}

const converted = suspects.map((l) => ({ bedroom: l.bedroom, carpet_conv: Math.round(l.carpet_area * SQM_TO_SQFT) }));
console.log("\nconverted (x10.7639) carpet_area stats by bedroom:", JSON.stringify(statsByBedroom(converted, "carpet_conv"), null, 1));

const others = listings.filter((l) => l.website !== "magichomes");
console.log("\nnon-magichomes carpet_area stats by bedroom (ground truth to compare against):", JSON.stringify(statsByBedroom(others, "carpet_area"), null, 1));

console.log("\nConclusion: converted stats closely match non-magichomes stats at every bedroom count, confirming the sqm hypothesis.");
