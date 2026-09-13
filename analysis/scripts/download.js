// Downloads the complete unfiltered dataset for listings, rentals, projects
// using offset-based pagination (page param is silently ignored — see
// INVESTIGATION_LOG.md). Verifies retrieved count matches reported total.
// Saves raw arrays to analysis/raw/*.json (gitignored). Never touches tokens.
"use strict";

const fs = require("fs");
const path = require("path");
const { apiRequest } = require("./client.js");
const { getValidToken } = require("./auth.js");

const RAW_DIR = path.join(__dirname, "..", "raw");
const LIMIT = 50; // actual max, not the documented 200 — see Phase B findings

async function downloadAll(endpoint, label) {
  const token = await getValidToken();
  let offset = 0;
  let total = null;
  const results = [];
  const seenIds = new Set();
  let idField = null;

  for (;;) {
    const freshToken = await getValidToken();
    const r = await apiRequest(`${endpoint}?limit=${LIMIT}&offset=${offset}`, { token: freshToken });
    if (r.status !== 200) {
      throw new Error(`${label}: unexpected status ${r.status} at offset ${offset}: ${JSON.stringify(r.json)}`);
    }
    const page = r.json;
    if (total === null) {
      total = page.total;
      console.log(`${label}: total reported = ${total}`);
    } else if (page.total !== total) {
      console.warn(`${label}: WARNING reported total changed mid-download: was ${total}, now ${page.total} at offset ${offset}`);
    }

    for (const rec of page.results) {
      if (!idField) idField = "listing_id" in rec ? "listing_id" : "project_id" in rec ? "project_id" : null;
      const id = idField ? rec[idField] : null;
      if (id !== null) {
        if (seenIds.has(id)) {
          console.warn(`${label}: duplicate id ${id} seen at offset ${offset} (API returned it twice across pages)`);
        }
        seenIds.add(id);
      }
      results.push(rec);
    }

    console.log(`${label}: fetched offset=${offset} count=${page.count} has_more=${page.has_more} (running total ${results.length}/${total})`);

    if (!page.has_more || page.results.length === 0) break;
    offset += LIMIT;

    // Phase B/C found the reported `total` is itself unreliable (undercounts
    // actual pageable records by ~9-10% on every collection endpoint), so we
    // terminate on has_more/empty-page, not on reaching `total`. This bound
    // only guards against a genuinely infinite/broken has_more.
    if (offset > Math.max(total, 1) * 3 + 1000) {
      throw new Error(`${label}: offset ${offset} is 3x+1000 past reported total ${total} with has_more still true — aborting to avoid runaway loop`);
    }
  }

  if (results.length !== total) {
    console.warn(`${label}: reported total (${total}) does NOT match actual paginated count (${results.length}) — see INVESTIGATION_LOG.md "total field is unreliable"`);
  } else {
    console.log(`${label}: OK — fetched ${results.length} records, matches reported total`);
  }

  fs.mkdirSync(RAW_DIR, { recursive: true });
  const outPath = path.join(RAW_DIR, `${label}.json`);
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        endpoint,
        fetched_at: new Date().toISOString(),
        reported_total: total,
        fetched_count: results.length,
        unique_id_count: seenIds.size,
        results,
      },
      null,
      2
    )
  );
  console.log(`${label}: wrote ${outPath}`);
  return { total, fetched: results.length, uniqueIds: seenIds.size };
}

async function main() {
  const summary = {};
  summary.listings = await downloadAll("/v1/listings", "listings");
  summary.rentals = await downloadAll("/v1/rentals", "rentals");
  summary.projects = await downloadAll("/v1/projects", "projects");
  console.log("\n=== Download summary ===");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("Download failed:", err.message);
  process.exit(1);
});
