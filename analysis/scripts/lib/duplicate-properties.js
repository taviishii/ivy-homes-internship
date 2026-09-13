// Q2: distinct physical properties among the listing records.
// See INVESTIGATION_LOG.md "Property identity methodology (Q2)".
//
// Identity key: (apartment_name, locality, floor, bedroom) narrows to
// candidates in the same building on the same floor with the same bedroom
// count. Within a candidate group, two records are the same physical unit
// only if they also: (a) come from different websites (genuine cross-portal
// listing, not a same-source re-post), (b) have carpet_area within 5% of
// each other, (c) have price within 15% of each other, and (d) have
// latitude/longitude within 0.01 degrees (~1.1km) of each other. The last
// constraint is essential: without it, a same-named building/locality/
// floor/bedroom combination that recurs elsewhere in the city (a false
// textual collision) gets wrongly merged. This exact threshold combination
// isn't sensitive to precise tuning — the pair count is stable (51-52)
// across a wide sweep of thresholds (see investigate-duplicates.js).
"use strict";

function findDuplicateProperties(listings) {
  const groups = new Map();
  for (const l of listings) {
    const key = [l.apartment_name, l.locality, l.floor, l.bedroom].join("|");
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
          pairs.push({ a: a.listing_id, b: b.listing_id, areaDiff, priceDiff, geoDist });
        }
      }
    }
  }

  // Union-find in case any listing matches more than one other (3+-way cluster).
  const parent = new Map();
  function find(x) {
    if (!parent.has(x)) parent.set(x, x);
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  }
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  for (const p of pairs) union(p.a, p.b);

  const components = new Map();
  for (const id of parent.keys()) {
    const root = find(id);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(id);
  }

  const duplicateReduction = [...components.values()].reduce((sum, c) => sum + (c.length - 1), 0);
  return { pairs, components: [...components.values()], duplicateReduction };
}

module.exports = { findDuplicateProperties };
