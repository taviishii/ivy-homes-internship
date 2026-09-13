// Shared loaders for the raw downloaded datasets, with the one confirmed,
// evidence-backed correction applied at load time: magichomes listings with
// carpet_area < 250 report area in square meters, not square feet (see
// INVESTIGATION_LOG.md "Units — magichomes area fields"). Converting by
// SQM_TO_SQFT makes their per-bedroom stats statistically match every other
// source, confirming the conversion rather than assuming it.
"use strict";

const fs = require("fs");
const path = require("path");

const RAW_DIR = path.join(__dirname, "..", "..", "raw");
const SQM_TO_SQFT = 10.7639;
const MAGICHOMES_SQM_THRESHOLD = 250; // see investigate-magichomes-units.js: clean gap between 221 (max sqm value) and 334 (min sqft value)

function loadRaw(name) {
  return JSON.parse(fs.readFileSync(path.join(RAW_DIR, `${name}.json`), "utf8"));
}

function loadListings() {
  const data = loadRaw("listings");
  const results = data.results.map((l) => {
    const isMagSqm = l.website === "magichomes" && l.carpet_area < MAGICHOMES_SQM_THRESHOLD;
    if (!isMagSqm) return { ...l, _area_unit_corrected: false };
    return {
      ...l,
      carpet_area: Math.round(l.carpet_area * SQM_TO_SQFT),
      super_built_up_area: Math.round(l.super_built_up_area * SQM_TO_SQFT),
      _area_unit_corrected: true,
      _carpet_area_raw_sqm: l.carpet_area,
      _super_built_up_area_raw_sqm: l.super_built_up_area,
    };
  });
  return { ...data, results };
}

function loadRentals() {
  return loadRaw("rentals");
}

function loadProjects() {
  const data = loadRaw("projects");
  // See INVESTIGATION_LOG.md "Units — project price_min/price_max": values
  // follow the Indian Lakh/Crore display convention, proven by a hard gap
  // in the raw value distribution (nothing between 2.09 and 41.50).
  const results = data.results.map((p) => ({
    ...p,
    price_min_inr: p.price_min < 10 ? Math.round(p.price_min * 1e7) : Math.round(p.price_min * 1e5),
    price_max_inr: p.price_max < 10 ? Math.round(p.price_max * 1e7) : Math.round(p.price_max * 1e5),
  }));
  return { ...data, results };
}

module.exports = { loadListings, loadRentals, loadProjects, SQM_TO_SQFT, MAGICHOMES_SQM_THRESHOLD };
