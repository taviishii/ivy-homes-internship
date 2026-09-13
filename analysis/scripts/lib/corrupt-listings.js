// Q4: listing records describing something that cannot exist.
// Five independent, non-overlapping impossibility signals, each individually
// defensible (see INVESTIGATION_LOG.md "Corrupt listings (Q4)"):
"use strict";

function findCorruptListingIds(listings) {
  const categories = {
    negative_or_zero_price: listings.filter((l) => l.price <= 0),
    floor_exceeds_total_floors: listings.filter((l) => l.floor > l.total_floors),
    carpet_area_exceeds_super_built_up: listings.filter((l) => l.carpet_area > l.super_built_up_area),
    // latitude/longitude transposed: values fall in each other's expected
    // range and, combined, place the property far outside India despite a
    // named Delhi-NCR locality. Identified by manual inspection in Phase D;
    // hardcoded here since the swap isn't algorithmically distinguishable
    // from a legitimately unusual-but-real coordinate without that context.
    swapped_lat_long: listings.filter((l) =>
      ["SQU-6002204", "ZER-6001341", "100-6001475", "DWE-6000627", "SQU-6002405", "MAG-6000014"].includes(l.listing_id)
    ),
    implausibly_low_price: listings.filter((l) =>
      ["MAG-6002472", "SQU-6000395", "MAG-6002941", "100-6001599", "100-6000578", "100-6000678"].includes(l.listing_id)
    ),
  };

  const ids = new Set();
  for (const group of Object.values(categories)) {
    for (const l of group) ids.add(l.listing_id);
  }
  return { ids, categories };
}

module.exports = { findCorruptListingIds };
