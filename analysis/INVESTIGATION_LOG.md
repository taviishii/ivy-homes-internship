# Investigation Log

Ongoing log of hypotheses tested against the live API, kept regardless of
whether they turned out true or false. Phase B (API reconnaissance) entries
below. Phase D (dataset-wide analysis) will append further entries once the
full dataset is downloaded.

Reference: `REFERENCE = 2026-09-10T00:00:00+05:30`. City is identified by
`city_id: 6` for this key (confirmed via `/v1/listings`, `/v1/rentals`,
`/v1/projects` responses, and `IVY_ASSIGNED_LOCALITY` filtering correctly).

---

## Auth

**Hypothesis:** `api_key` as a query parameter authenticates requests, as documented.
**Motivation:** Directly stated in API_REFERENCE.md "Authentication" section.
**Test:** `GET /v1/listings?api_key=<key>` with no other auth.
**Result:** `401 {"detail":"send your key in the X-API-Key request header, not as a query parameter"}`.
**Conclusion:** FALSE. Key must be sent as `X-API-Key` header. Confirmed discrepancy.

**Hypothesis:** `POST /auth/login` returns `token`/`expires_in: 86400` as documented.
**Motivation:** Directly stated in API_REFERENCE.md.
**Test:** Logged in with `demo1@ivy.homes` + assigned password.
**Result:** Returns `access_token` + `refresh_token` (not `token`), `expires_in: 900` (15 min, not 24h), plus a `refresh_url: "/auth/refresh"`. `user` object has only `email`, no `name`.
**Conclusion:** FALSE on multiple counts. Confirmed discrepancy (response shape, expiry, undocumented refresh flow).

**Hypothesis:** There is no token refresh flow, as documented ("There is no refresh flow").
**Motivation:** Directly contradicted by `refresh_url` field returned from login.
**Test:** `POST /auth/refresh` with `{"refresh_token": ...}`.
**Result:** `200`, returns a fresh access/refresh token pair with the same shape as login.
**Conclusion:** FALSE — a refresh flow exists and works. This is load-bearing for the frontend's "session survives 30 minutes" requirement, since access tokens expire in 15 minutes.

**Hypothesis:** `POST /auth/logout` invalidates the token server-side, as documented.
**Motivation:** Directly stated in API_REFERENCE.md.
**Test:** Called logout with a valid access token, inspected response.
**Result:** `200 {"ok":true,"note":"tokens are stateless; discard them client side"}`. No server-side revocation occurs (consistent with a stateless JWT).
**Conclusion:** FALSE. Confirmed discrepancy — logout is a client-side no-op.
**Note (process):** A test script briefly printed a full access/refresh token pair to the console (a redaction bug: the helper checked for a `token` field but the API returns `access_token`/`refresh_token`). Fixed the redaction helper immediately and invalidated the exposed token via `/auth/logout` as a precaution, though logout does not actually revoke it server-side per the finding above — exposure window was small (15 min token lifetime, demo-account-only scope, not persisted to any file, only this recon session's terminal output).

---

## Endpoints — existence / path

| Documented path | Actual | Status |
|---|---|---|
| `GET /v1/listing/{id}` (singular) | 404 | Real path is `GET /v1/listings/{id}` (plural) |
| `GET /v1/listings/{id}/similar` | 404 | Does not exist at all; no alternate found |
| `GET /v1/favourites`, `POST /v1/favourites`, `DELETE /v1/favourites/{id}` | 404 | Real path is `/v1/saved` (see below) |
| `GET /v1/analytics/summary` | 404 | Does not exist; tried `/v1/analytics`, `/v1/stats`, `/v1/insights`, `/v1/dashboard`, `/v1/summary`, `/v1/city/summary` and others — all 404 |
| `GET /v1/rentals/{id}` | 200 | Matches documentation |
| `GET /v1/projects/{id}` | 200 | Matches documentation |

**Hypothesis:** Favourites feature lives at a slightly different, guessable path.
**Motivation:** `/v1/favourites` 404s on every method; other endpoints in this API have shown path deviations, and the assignment doesn't expect a fully-missing required feature.
**Test:** Tried `/v1/favorites`, `/v1/saved`, `/v1/saved-listings`, `/v1/bookmarks`, `/v1/wishlist`, `/v1/users/me/favourites`, etc.
**Result:** `/v1/saved` returns `200 {"count":0,"results":[]}` on GET. POST requires body field `listing_id` (not `id` as documented — `{"id": ...}` gives a 422 "Field required: listing_id"). Full add → list → remove cycle confirmed working against `/v1/saved`.
**Conclusion:** TRUE. Confirmed undocumented_endpoint + a request-body field-name discrepancy.

**Hypothesis:** Analytics summary lives at a different path.
**Motivation:** Same reasoning as favourites.
**Test:** Tried ~10 plausible alternate paths (see table above).
**Result:** All 404.
**Conclusion:** Endpoint appears genuinely absent. Insights screen will need to be computed from the downloaded listings/rentals/projects datasets instead.

---

## Pagination

**Hypothesis:** `page` (1-indexed) controls which page of results is returned, as documented.
**Motivation:** Directly stated in API_REFERENCE.md pagination table.
**Test:** `GET /v1/listings?page=1&limit=2` vs `?page=2&limit=2` vs `?offset=2&limit=2`.
**Result:** `page=1` and `page=2` both returned `offset: 0` and the identical first record. `offset=2` correctly advanced the result set.
**Conclusion:** FALSE. `page` is silently accepted but ignored; real pagination is `offset`/`limit`-based. Confirmed discrepancy — directly relevant to correctly paging to the end for Part 2.

**Hypothesis:** `limit` maxes out at 200, as documented.
**Motivation:** Directly stated in API_REFERENCE.md.
**Test:** `limit=51`, `100`, `200`, `250` on `/v1/listings`.
**Result:** All four were silently clamped to `50`.
**Conclusion:** FALSE. Actual max is 50, not 200. Confirmed discrepancy — changes the request budget for full dataset retrieval (Phase C) upward from the documented estimate.

**Hypothesis:** Default `limit` (no param) is 20, as documented.
**Motivation:** Directly stated in API_REFERENCE.md.
**Test:** `GET /v1/listings` with no query params.
**Result:** `limit: 20` returned.
**Conclusion:** TRUE — matches documentation, no discrepancy here.

**Hypothesis:** Response shape is `{total, page, page_size, results}` as documented.
**Motivation:** Directly stated in API_REFERENCE.md.
**Test:** Inspected real response.
**Result:** Actual shape is `{limit, offset, count, total, has_more, results}`.
**Conclusion:** FALSE. Confirmed discrepancy (pagination category). `has_more` is actually a nice addition not in the doc — makes "page all the way to the end" unambiguous, which is good for Part 2 answers.

---

## Filters

**Hypothesis:** `locality`, `bhk`, `min_price`/`max_price`, `furnishing`, `property_type` filters on `/v1/listings` actually filter.
**Motivation:** Assignment explicitly warns some documented filters are silently ignored; need to check each one against the live data rather than trust a 200 response.
**Test:** Applied each filter individually with a small limit, checked returned field values matched the filter and that `total` differed sensibly from the unfiltered total.
**Result:** All five work correctly — `locality=<assigned locality>` returned only that locality, `bhk=2` returned only `bedroom: 2`, price range filtered correctly, `furnishing=semi-furnished` returned only that value, `property_type=villa` returned only villas.
**Conclusion:** TRUE for all five — no discrepancy. Good example of documentation that held up.

**Hypothesis:** `project_id` is a usable filter on `/v1/listings` (implied by the Projects doc: "it always agrees with what `GET /v1/listings?project_id=...` returns").
**Motivation:** Needed to independently verify project ↔ listing joins for Q10, and the doc explicitly references this exact call shape.
**Test:** `GET /v1/listings?project_id=P60001` vs `?project_id=P60004` vs `?project_id=P60009`.
**Result:** All three returned the identical, full unfiltered result set (`total: 3196` — the entire listings dataset), not filtered to the project.
**Conclusion:** FALSE. `project_id` is silently ignored on `/v1/listings`. This directly invalidates the documented method for verifying `total_listings`, and confirms Q10 requires an independent client-side join (as the assignment instructs) rather than the documented query. Confirmed discrepancy (filters category), high relevance to Q10.

---

## Sorting

**Hypothesis:** `sort_by=price`, `sort_by=carpet_area`, `sort_by=bedroom` produce a correctly sorted sequence.
**Motivation:** Assignment explicitly says to verify sort ordering mathematically rather than trust a 200 response.
**Test:** Fetched 10–50 records with each sort key + `order`, checked programmatically against a sorted copy of the same values.
**Result:** All three sorted correctly (price desc, carpet_area asc, bedroom asc all verified).
**Conclusion:** TRUE for these three — no discrepancy.

**Hypothesis:** `sort_by=posted_at` produces a correctly sorted sequence.
**Motivation:** Same as above.
**Test:** Fetched 50 records with `sort_by=posted_at&order=desc`, checked pairwise ordering.
**Result:** 20 of 49 adjacent pairs violated strict descending order. Values on the same calendar date appear in no discernible time-of-day order (e.g. `23:01 → 22:53 → 18:47 → 21:44 → 00:05...`), consistent with the field being sorted at day granularity only, with unsorted (or differently-keyed) ties within a day.
**Conclusion:** FALSE. Confirmed discrepancy (sorting category) — `sort_by=posted_at` does not produce a fully sorted result.

---

## Timestamps

**Hypothesis:** All timestamps are ISO 8601 UTC with a `Z` suffix, as the documented convention claims "everywhere in the API".
**Motivation:** Directly stated in the Conventions table.
**Test:** Compared `posted_at` on `/v1/listings` vs `/v1/rentals`.
**Result:** Rentals' `posted_at` has a `Z` suffix (e.g. `2026-09-07T01:17:00Z`). Listings' `posted_at` has **no** timezone designator at all (e.g. `2026-08-19T10:52:00`).
**Conclusion:** FALSE for listings, TRUE for rentals — an internal inconsistency between two endpoints that both claim to follow the same documented convention. Confirmed discrepancy (timestamps/consistency category). Still need to determine (Phase D, with full dataset) whether the offset-less listings timestamps are IST or UTC in substance, since this materially affects Q8.

**Observation (not yet a conclusion):** Some `listings.posted_at` values are in 2027, which is after both the real "today" and the assignment's REFERENCE date. Needs Phase D investigation — could be data quality noise, or could correlate with the corrupt/fake listing questions (Q4/Q9). Not classified as anything yet; no strong evidence collected beyond noticing the values exist.

---

## Data quality / completeness (listings endpoint scope)

**Hypothesis:** `/v1/listings` returns only active listings, with inactive/expired/withdrawn excluded server-side, as documented ("anything this endpoint returns is safe to show to a user").
**Motivation:** Directly stated in API_REFERENCE.md, and the endpoint returns an explicit `is_live` field that isn't mentioned in the documented listing object at all — suggesting the doc's example predates a schema change.
**Test:** Sampled 50 unfiltered records, checked `is_live` distribution.
**Result:** 38 of 50 were `is_live: true`, 12 were `false`. The field is present and mixed on every page checked.
**Conclusion:** FALSE. The endpoint returns both live and non-live listings; `is_live` must be checked/filtered client-side. This is directly relevant to Q1 vs Q3 (total records vs active records are genuinely different numbers) and confirms the doc's completeness claim is wrong. Confirmed discrepancy (completeness category).

---

## Units

**Hypothesis:** `price_min`/`price_max` on `/v1/projects` are raw-rupee integers, as documented ("in rupees").
**Motivation:** Sampled values were implausibly small for rupees (e.g. `1.66`, `4.54`) — clearly not raw integer rupees.
**Test:** Sampled 20 projects' `price_min`/`price_max`. Cross-referenced three specific projects (`P60001`, `P60004`, `P60009`) against real listing prices in the same locality carrying that `project_id` (found via `locality` filter, since `project_id` filter is broken — see Filters section), since documented pagination convention couldn't be trusted at face value.
**Result:** Values are inconsistent in scale even within the same field: some `price_min`/`price_max` pairs look like both are in crores (e.g. `1.66`/`4.54`), others clearly mix lakhs and crores within a single record (e.g. `price_min: 94.6, price_max: 2.15` — cross-referenced actual listing price ₹21,780,000 for that project, which is ≈2.178 Cr, consistent with `price_max` being crores and `price_min` (94.6) being lakhs, i.e. ₹9,460,000 = 94.6 Lakh). This matches the common Indian real-estate display convention of switching from "Lakh" to "Cr" notation at the ₹1,00,00,000 threshold, applied independently to `price_min` and `price_max` — but with no unit field to disambiguate a raw value programmatically.
**Conclusion:** Confirmed discrepancy (units category) — not raw rupees. Not yet fully resolved: a robust per-record conversion rule (needed for Q7's `price_max_inr`) requires further cross-referencing across many projects in Phase D, since raw values in the ~1–50 range are ambiguous between "crores" and "large lakhs" without an external anchor. Flagged as the top priority for Phase D.

---

## Requests used in Phase A/B

~90 requests logged in `analysis/log/requests.jsonl` (gitignored) during Phase A/B — all against documented + a small number of plausible undocumented paths, well under the 1200/min rate limit and the ~150-request full-dataset estimate for Phase C.

---

# Phase C — Full dataset retrieval

Downloaded via `analysis/scripts/download.js` (offset/limit pagination, limit=50, terminating on `has_more:false` rather than on reaching the API's reported `total`). Raw output saved to `analysis/raw/{listings,rentals,projects}.json` (gitignored).

## Hypothesis: the API's reported `total` is accurate

**Motivation:** needed to know when to stop paging, and to sanity-check Q1.
**Test:** paged every collection endpoint all the way to `has_more:false` and compared the record count actually retrieved against the `total` field reported on every page.
**Result:** every endpoint's actual retrievable count exceeds its reported `total`: listings 3500 vs reported 3196 (+304, +9.5%), rentals 1320 vs reported 1205 (+115, +9.5%), projects 400 vs reported 365 (+35, +9.6%). Re-ran the full listings pagination independently a second time: identical 3500 unique `listing_id`s both times, zero duplicates, zero IDs unique to either run — ruling out a live-changing dataset / offset-drift race condition as the explanation. The ~9.5% undercount ratio is essentially identical across three unrelated entity types, which is more consistent with a single stale cached counter (e.g. computed before a later data-generation pass added ~9.5% more rows to every table) than with three independent bugs.
**Conclusion:** CONFIRMED discrepancy (pagination/completeness). `total` cannot be trusted as the record count; "retrievable" per the assignment's own definition ("paging all the way to the end") is the number of records actually returned when paging to `has_more:false`. **This directly sets Q1 = 3500**, not 3196.

---

# Phase D — Hypothesis-driven analysis

## A. Project price units (price_min / price_max)

**Hypothesis:** `price_min`/`price_max` follow the Indian real-estate convention of switching between "Lakh" and "Crore" notation at the ₹1,00,00,000 (1 Crore) threshold, rather than being raw rupees.
**Motivation:** Phase B found values like `1.66`/`4.54` — implausible as raw rupees, and a single cross-referenced example (P60004) was consistent with mixed units.
**Test:** Sorted all 400 projects' `price_min` values. Found a hard, exact gap in the raw value distribution: every value falls in either `[1.00, 2.09]` or `[41.50, 99.90]`, with *zero* values in `(2.09, 41.50)`. Converting the low range as Crores (×1e7) and the high range as Lakhs (×1e5) produces one continuous, gapless range of true rupee values from ₹41.5L to ₹2.09Cr — exactly the behavior of the Lakh/Crore display-notation switch at the 1 Crore boundary. Cross-referenced three projects' `price_min`/`price_max` against their real listings' prices (joined client-side by `project_id`, since that filter is broken on `/v1/listings` — see Phase B) and the conversion produced order-of-magnitude-consistent results.
**Result:** `price_max` shows the same pattern (397/400 values cleanly in the Crore range `[1.00, 5.83]`; 3 outliers in the high-80s/90s that don't cleanly fit either interpretation when cross-checked against their own project's listings — most likely stale/wrong project-aggregate values, consistent with the Q10 finding that project aggregates are frequently wrong, rather than evidence against the general rule).
**Conclusion:** CONFIRMED discrepancy (units). Rule used everywhere in the analysis: `raw < 10` ⇒ `actual = raw × 1e7` (Crore); `raw >= 10` ⇒ `actual = raw × 1e5` (Lakh). Reproducible in `investigate-price-units.js`. This directly resolves **Q7**: `{"project_id": "P60060", "price_max_inr": 58300000}`, well clear of the second-highest converted value (₹56.6M), so the 3 ambiguous outliers can't change the answer even under the least favorable interpretation.

## B. Listings `posted_at` timezone

**Hypothesis (tested and rejected):** posting times follow a realistic diurnal human-activity pattern that could reveal the timezone by comparison with rentals' known-UTC timestamps.
**Test:** Computed an hour-of-day histogram for rentals' UTC `posted_at`.
**Result:** Flat/uniform across all 24 hours (counts 38-77, no diurnal signal). Timestamps are generated uniformly at random with no realistic activity pattern.
**Conclusion:** FALSE — this approach doesn't work on this dataset; abandoned in favor of a generation-cutoff boundary test.

**Hypothesis:** the dataset's records were generated with a hard cutoff at `REFERENCE = 2026-09-10T00:00:00+05:30`, and this cutoff can reveal which timezone listings' offset-less `posted_at` is expressed in.
**Motivation:** the assignment anchors everything to REFERENCE; `/health`'s `reference_date` field independently echoes the same timestamp, suggesting it's a meaningful boundary for the dataset, not just an evaluation artifact.
**Test:** For rentals (confirmed UTC via the `Z` suffix), checked for any `posted_at >= 2026-09-09T18:30:00Z` (REFERENCE converted to UTC) — found none; the latest rental is exactly at that boundary. For listings, checked the day-by-day record count near the boundary and the full time-of-day spread on the last populated calendar day.
**Result:** Rentals cut off exactly at REFERENCE in UTC terms, confirming a hard generation cutoff exists. Listings' raw "2026-09-09" calendar day contains records spanning the *entire* 24-hour range (00:05 through 23:46) with zero records on "2026-09-10" (aside from 6 isolated far-future outliers, handled separately below). If listings' `posted_at` were UTC, the same REFERENCE cutoff (18:30 UTC) would truncate "2026-09-09" mid-day — records after 18:30 UTC would already be into 2026-09-10 IST and should be absent. They are not absent; the day is fully populated through 23:46.
**Conclusion:** CONFIRMED (well-evidenced, not merely "appears to be"): **listings' `posted_at` is naive local IST**, not UTC, despite carrying no offset — and despite the documented convention claiming UTC "everywhere in the API" (rentals *do* correctly use UTC+Z, so this is specifically a listings-endpoint discrepancy). Cross-validated against rentals' independently-confirmed UTC cutoff at the same REFERENCE moment. **This directly resolves Q8**: compare the naive IST interval `[2026-09-03T00:00:00, 2026-09-10T00:00:00)` against the raw strings with no conversion. Answer: **129**.

## C. 2027-dated (and other post-REFERENCE) listings

**Motivation:** given B's finding that REFERENCE is a hard generation cutoff, any listing with `posted_at >= REFERENCE` is itself anomalous — it couldn't have been generated by the same process as the other 3494 records.
**Test:** Found exactly 6 listings with `posted_at >= 2026-09-10T00:00:00` (naive IST), dated 2026-11-14, 2026-11-30, 2026-12-30, 2027-04-21, 2027-05-09, 2027-06-23 — sparse, isolated, one per day, unlike the dense daily volume (10-35/day) of the normal pre-REFERENCE data.
**Result:** Inspected all 6 individually. One (`MAG-6002328`) has `carpet_area: 109` for a 3-bedroom/3-bathroom apartment — but this is a magichomes record where carpet_area is in square meters (see units finding below); converted, it's a perfectly ordinary listing. Checked the other 5 for internal impossibility (floor vs total_floors, carpet vs super_built_up, price sign, bathroom/bedroom ratio) — none show any impossible combination. Checked `posted_by_contact` for all 6 against the fake-listing multi-name-per-contact signal (section F) — none match.
**Conclusion:** These 6 records are neither corrupt (no internally impossible field combination once units are corrected) nor fake by the identified fraud signal. They are **timestamp/generation artifacts** — the underlying record is an otherwise ordinary listing, but its `posted_at` value is impossible given the dataset's own generation cutoff. Not included in Q4 or Q9 answers, since neither has direct evidence for those specific classifications; noted here as an open, low-confidence anomaly rather than force-fit into either bucket. Recorded as a documentation/data_quality-adjacent observation, not a submitted finding, since it doesn't cleanly map to one of the fixed finding categories on its own (it's closest to `timestamps`, but the impact is on data trustworthiness rather than a documented-vs-actual API contract) — the units and pagination-total findings already cover the two things this investigation surfaced that *do* map cleanly to categories.

## D. Property identity methodology (Q2)

**Hypothesis (rejected):** exact-match on `(latitude, longitude)` identifies distinct properties.
**Test:** Grouped by exact lat/long.
**Result:** 245 groups share an exact coordinate, covering 519 records — but inspecting them shows these are **different units in the same building** (same `apartment_name`, but different `floor`, `bedroom`, `carpet_area`, `price`). Lat/long in this dataset is building-level, not unit-level.
**Conclusion:** FALSE — naive coordinate matching would wrongly merge distinct units and undercount properties.

**Hypothesis (rejected):** exact match on `(latitude, longitude, floor, bedroom)` identifies distinct properties.
**Test:** Grouped by this 4-tuple.
**Result:** Zero duplicate groups — every listing has a unique combination.
**Conclusion:** FALSE as a duplicate-finder — too strict; genuine cross-portal duplicates apparently don't share bit-for-bit identical GPS coordinates (independent geocoding per source varies slightly).

**Hypothesis (confirmed):** the same physical property, cross-listed by multiple portals, can be identified by requiring an exact match on `(apartment_name, locality, floor, bedroom)` (narrows to "same building, same floor, same bed count") plus close agreement on `carpet_area` (<5% apart), `price` (<15% apart), and raw lat/long (<0.01°, ~1.1km) — with the two records coming from *different* websites (ruling out a same-source re-post rather than a genuine independent duplicate).
**Motivation:** the structural 4-tuple alone produces 89 candidate groups (180 records) with plausible but not certain duplicates; needed additional numeric agreement to separate "same unit, independently listed" from "different but architecturally identical unit in a large building."
**Test:** Applied the full threshold set; manually inspected all resulting pairs. One early candidate pair (before adding the geo constraint) matched on all criteria except geography — coordinates ~33km apart — confirming it was a coincidental locality/building-name collision, not a duplicate. Adding the geo constraint removed it. Swept the three numeric thresholds (area/price/geo) across tight/base/loose/very-loose settings; the resulting pair count stayed stable at 51-52 across the entire sweep, indicating a genuine cluster boundary in the data rather than a tuning artifact (`investigate-duplicates.js`).
**Result:** 52 duplicate pairs found (104 records), all as clean 2-record clusters (no listing matched more than one other — no 3+-way clusters).
**Conclusion:** CONFIRMED, robust methodology. **Q2 = 3500 − 52 = 3448.**

## E. Corrupt listings (Q4)

Five independent, mutually-exclusive, and individually defensible "physically impossible" signals (reproducible in `lib/corrupt-listings.js`):

1. **`price <= 0`** (6 records) — negative sale prices (e.g. -8,550,000). A property cannot have negative value; all other fields on these records are otherwise unremarkable.
2. **`floor > total_floors`** (6 records) — e.g. floor 26 of an 11-floor building. Physically impossible.
3. **`carpet_area > super_built_up_area`** (6 records) — carpet area (usable area within walls) cannot exceed super built-up area (which includes it plus common areas/walls) by definition.
4. **Swapped latitude/longitude** (6 records) — values fall in ranges consistent with the two fields being transposed (e.g. `latitude: 76.87515, longitude: 28.40613` — the reverse of every other record's `lat≈28.x, long≈76-77.x` pattern for this city), placing the property outside India despite a named Delhi-NCR locality (`sector 82`, `new gurgaon`, etc.). Identified by manual inspection after the automated `lat/long out of India bounds [6-38, 68-98]` check flagged exactly these 6.
5. **Implausibly low positive price** (6 records, ₹5,030–₹26,260) — no real apartment sells for under ten thousand rupees; multiplying by 1000 in each case produces a price consistent with comparable listings in the same locality/bedroom count, suggesting a missing scale factor, but the record as given describes an economically impossible transaction regardless of the hypothesized cause.

**Hypothesis tested and rejected:** a much larger set of "corrupt" candidates (317 records, `carpet_area/bedroom < 100 sqft`) turned out to be entirely explained by a units bug (see F below), not corruption — after correcting units, zero of these remain anomalous. This is exactly the "distinguish impossible from merely unusual" caution the assignment gives, and the reason unit-correction was done *before* finalizing Q4.

**Hypothesis tested and rejected:** `total_floors <= 0` (103 records) looked suspicious in isolation, but all 103 are `property_type: plot` with `floor: 0, total_floors: 0` — correct and expected for vacant land, which has no floors. Not corrupt.

Cross-checked all 30 final candidates against the Q9 fake-listing signal (contact-frequency, multi-name-per-contact) — zero overlap, and no unusual contact-frequency pattern among them, supporting that these are scattered data-entry/generation errors rather than a coordinated fraud pattern.

**Q4 = 30 listing IDs** (sorted list in `analysis/results/answers.json`).

## F. Units — magichomes area fields

**Hypothesis:** a subset of `magichomes`-sourced listings report `carpet_area`/`super_built_up_area` in square meters, not square feet as documented.
**Motivation:** a blunt "carpet_area/bedroom < 100 sqft" sweep for Q4 flagged 317 records, and *all 317* had the `MAG-` listing ID prefix (i.e. all from one website) — too clean a correlation with one data source to be scattered corruption.
**Test:** Printed the full sorted `carpet_area` distribution for magichomes listings within each bedroom count (0 through 5) separately.
**Result:** Every bedroom count shows a clean **bimodal** split: a tight low cluster (e.g. bedroom=1: 36-52) and a separate high cluster (e.g. bedroom=1: 334-674), with a hard gap between them and no overlap, in every bedroom group. The global low-cluster maximum (221, from bedroom=3) sits well below the global high-cluster minimum (334, from bedroom=1), so a single threshold (`carpet_area < 250`) cleanly separates suspects from normal records regardless of bedroom count. Converting the low cluster by ×10.7639 (sqm→sqft) and recomputing per-bedroom average carpet_area produces numbers matching non-magichomes listings almost exactly (e.g. bedroom=3: converted avg 1212.1 vs non-magichomes avg 1198.0; bedroom=5: 1944.2 vs 1925.4). The `super_built_up_area/carpet_area` ratio is unchanged by the conversion (≈1.34, matching every other source), confirming both area fields need the same correction together.
**Result:** 323 of 767 magichomes listings (42%) are affected.
**Conclusion:** CONFIRMED discrepancy (units) — high confidence, reproducible in `investigate-magichomes-units.js`. Applied automatically for all downstream analysis via `lib/load-data.js`. **This materially changes Q6**: computing avg price/sqft for 2BHK without the correction gives ₹27,578.00/sqft (nearly double); with it, ₹14,465.77/sqft — the corrected figure is the one used.

## G. Fake listings (Q9)

**Hypothesis:** a phone number reused across multiple, genuinely different `posted_by_name` values indicates a lead-generation operation posting listings under invented "seller" identities.
**Motivation:** needed a systematic signal distinct from Q4's data-corruption signals, per the assignment's explicit instruction to distinguish fraud from ordinary bad data.
**Test:** For every `posted_by_contact`, collected the set of distinct `posted_by_name` values used with it. Checked whether this was plausibly just random name/number pairing noise (i.e. names and numbers independently assigned per record) by checking the overall name pool size (276 distinct names across 3500 listings) — if names were independently assigned per record, a contact reused 13+ times would only keep one consistent name by chance with vanishingly small probability, yet 3 single-name contacts do have exactly 13 listings apiece, and 581/593 contacts (98%) never show more than one name even at volumes up to 13. This establishes that the dataset normally *does* keep name tied consistently to a contact, making violations of that norm meaningful rather than incidental.
**Result:** 12 contacts (2% of 593) are tied to 3-6 distinct names each. Checked for a volume-based artifact (i.e. maybe only high-volume contacts show this by chance) — found no clean separation by volume (multi-name contacts range 13-35 listings, overlapping the single-name group's own top range of 11-13), so multi-name-ness itself, not volume, is the operative signal. Checked corroborating signals: the 12 hub contacts collectively span 230 listings, cover 6-10 of the city's ~10-15 localities each (vs. a genuine agent who'd typically specialize), always list as `posted_by: agent` (never owner/builder), and price on average 19% below the dataset-wide average price/sqft (₹11,403 vs ₹14,153) — consistent with (if not conclusive proof of) bait pricing to generate enquiries. `is_verified` rate was *higher* among suspects (73% vs 59%), which doesn't fit a naive "fake = unverified" assumption — tested and found this signal uninformative/inconclusive, not corroborating, so it wasn't used as supporting evidence.
**Conclusion:** CONFIRMED via a systematic, multi-signal pattern (identity-sharing + city-wide locality spread + below-market pricing), reproducible in `lib/fake-listings.js`. Cross-checked for overlap with the Q4 corrupt list — zero overlap, keeping the two categories cleanly separated as the assignment intends.
**Q9 = 230 listing IDs** (sorted list in `analysis/results/answers.json`).

## H. Project listing counts (Q10)

**Hypothesis:** `project.total_listings` disagrees with an independent join of listings to projects by `project_id`.
**Motivation:** the assignment explicitly warns not to trust the documented `GET /v1/listings?project_id=...` shortcut, which Phase B already proved is silently ignored.
**Test:** Counted, for each project, how many downloaded listings actually carry that `project_id`, and compared against the project's own `total_listings` field.
**Result:** 295 of 400 projects (73.75%) disagree. Checked the direction of the mismatch: 240 undercounts (actual > reported) vs. 55 overcounts (actual < reported) vs. 105 exact matches. The heavy skew toward undercounting is consistent with the same explanation as the pagination-`total` bug (Phase C) — `total_listings` looks like a stale count from before more listings were added to the dataset, not a live-computed aggregate as documented.
**Conclusion:** CONFIRMED. **Q10 = 295.**

---

# Confirmed documentation discrepancies (Part 3 candidates) — running list after Phase C/D

In addition to the Phase A/B findings already logged above, Phase C/D add:

- **Pagination `total` is inaccurate on every collection endpoint** (`/v1/listings`, `/v1/rentals`, `/v1/projects`): undercounts the actual paginable record count by ~9.5-9.6% consistently, verified by paging every endpoint to `has_more:false` and reproducing an identical result set on a second independent run. Category: `pagination`.
- **`/v1/projects` `price_min`/`price_max` are not raw rupees**: they follow the Indian Lakh/Crore display-notation convention, proven by a hard, exact gap in the raw value distribution that closes into one continuous rupee range under the standard conversion. Category: `units`.
- **A subset of `magichomes`-sourced `/v1/listings` records report `carpet_area`/`super_built_up_area` in square meters, not square feet**: 323/767 (42%) of magichomes listings, identified by a clean bimodal per-bedroom distribution and confirmed by the converted values matching every other source's per-bedroom averages almost exactly. Category: `units`.
- **`/v1/listings` `posted_at` carries no timezone designator and is not UTC** despite the documented "UTC, Z suffix, everywhere" convention (which `/v1/rentals` `posted_at` *does* correctly follow) — it is naive local IST, proven via a generation-cutoff cross-check against rentals' independently-confirmed UTC cutoff at the same REFERENCE moment. Category: `timestamps` (also arguably `consistency`, since the two endpoints disagree on the convention they both claim to follow).
- **`project.total_listings` disagrees with an independent join to `/v1/listings` by `project_id` for 295/400 projects (73.75%)**, contradicting the documentation's claim that it "always agrees with what `GET /v1/listings?project_id=...` returns" (itself also wrong, since that filter is silently ignored — already logged in Phase B). Category: `consistency`.

See `analysis/results/answers.json` for the full computed answer set with supporting counts.

---

# Phase E — Independent validation

Treated every Phase C/D answer as a hypothesis, not a result. Re-derived all ten from the raw datasets with fresh code (`analysis/scripts/validate.js`, which does not import `lib/corrupt-listings.js`, `lib/fake-listings.js`, or `lib/duplicate-properties.js`), specifically hunting for counterexamples to the two judgment-call-heavy answers (Q2, Q9) and the one answer explicitly flagged as risky (Q4's price category). `answers.json` (Phase C/D) is preserved unchanged; `validated_answers.json` holds the Phase E result for comparison.

## Q1 / Q3 — re-confirmed, no change

**Test:** Recounted `listing_id`/`is_live` directly from the raw JSON files (no reuse of Phase C/D code), then, separately, made **fresh live API calls** (a day after the original download) checking `has_more` right at the API's reported `total` boundary and at the true end-of-pagination offset for all three endpoints.
**Result:** Raw-file recount: 3500 listings (3500 unique IDs, zero nulls), 2792 `is_live:true` / 708 `false` (no other values). Live re-check: `has_more:true` at offset 3146/1155/315 (the reported-total boundary) for listings/rentals/projects; pagination genuinely ends at offset 3450+50=3500 / 1300+20=1320 / 350+50=400 — identical to the Phase C download, reproduced independently a day later.
**Conclusion:** CONFIRMED, high confidence. Q1=3500, Q3=2792 unchanged. The `total`-undercount bug is not a one-time artifact — reproduced on three independent occasions (two full downloads one day apart, plus a live boundary spot-check) across all three endpoints.

## Q2 — property identity: methodology gap found, answer revised 3448 → 3254

**Hypothesis tested and rejected (again):** exact-string `apartment_name` matching is sufficient.
**Motivation:** the user asked to explicitly test normalized-field matching as an alternative.
**Test:** Compared the count of distinct `apartment_name` values exact vs. lowercased+whitespace-collapsed.
**Result:** 683 exact vs. 517 normalized — 134 collision groups, e.g. `"Godrej Residency"` / `"godrej residency"` / `"GODREJ RESIDENCY"` / `"Godrej  Residency"` (double space) all refer to the same building. Re-running the duplicate-pair detection with case/whitespace normalization (keeping every other threshold identical: floor+bedroom exact, carpet_area <5%, price <15%, geo <0.01°, different website) found **150 additional genuine pairs** beyond the original 52, all with 100% agreement on `furnishing`, `facing_direction`, and `bathroom` — none of which were matching criteria. (Under independent random assignment, agreement across three unrelated multi-valued fields this consistently is a ~1-in-24-per-pair coincidence; getting it 202/202 times is not plausible by chance.)
**Further test:** checked remaining punctuation in `apartment_name` for other formatting variants. Found 53 names using hyphens instead of spaces (`"Casagrand-Residency"`). Extended normalization to fold hyphens to spaces; found 254 total pairs (52 more than the case-only-normalized 202), still 100% corroborated on the same three independent fields, including 6 genuine three-way clusters (same unit listed by three different portals).
**Counterexample check (requested explicitly):** manually inspected every "closest miss" — group members that shared the structural key but didn't pass the numeric/geo thresholds. All closest misses were either (a) same-website (excluded by design — a single source doesn't duplicate-list its own property under two IDs) or (b) large (10-70%) price/area divergence consistent with genuinely different units in a large building with a repeated floor plan. No evidence of missed true duplicates (false negatives) in the candidate pool. One would-be pair (before the geo constraint was added, in Phase D) was a confirmed false positive — identical structural key and close price/area, but coordinates ~33km apart (`ZER-6000219` vs `DWE-6001109`) — demonstrating why the geo constraint is necessary, not optional.
**Threshold sensitivity:** swept area/price/geo thresholds from tight (2%/10%/0.005°) to very loose (10%/30%/0.05°); duplicate-reduction count stayed in a narrow band (245-248) across the entire sweep — a stable natural cluster boundary, not a tuning artifact.
**Also checked (found NOT to be an issue):** edit-distance-1/2 near-misses in `apartment_name` beyond hyphen/case, e.g. `"Sobha Terraces"` vs `"Lodha Terraces"` — inspected and confirmed these are **genuinely different real developer brand names** ("Sobha" and "Lodha" are both real, distinct Indian developers) that happen to share a common suffix word, not typos of the same building. Correctly left unmerged.
**Conclusion:** CONFIRMED discrepancy in the Phase C/D methodology — exact-string matching silently missed a third of the true duplicate population because of untreated formatting noise in the source data. **Revised Q2 = 3500 − 246 = 3254** (previous answer 3448 was outside the ±1% tolerance band of this validated figure — a real, not cosmetic, correction).

## Q4 — corrupt listings: "implausible" vs. "impossible", 30 → 24

Re-examined each of the five Phase C/D categories against the specific question "does this violate a hard rule, or is it merely very unlikely?", per the user's explicit instruction not to conflate the two.

- **`price <= 0`** (6): a transaction price is a magnitude; negative is not a value it can take. HELD — genuinely impossible, kept.
- **`floor > total_floors`** (6): checked `property_type` for each (apartment, apartment, apartment, apartment, independent house, builder floor) — none is a `plot` (which legitimately has `floor=0, total_floors=0`, confirmed separately: all 103 plot records show this and are correctly not flagged). A floor number exceeding a building's own declared floor count is a hard physical impossibility regardless of property type. HELD, kept.
- **`carpet_area > super_built_up_area`** (6): checked `property_type` — 5 apartment, 1 villa. Separately confirmed all 103 `plot` records show `carpet_area == super_built_up_area` exactly (a legitimate convention: land has no common-area distinction) and *none* of the 6 flagged records are plots, so the architectural definition (carpet ⊆ super built-up) genuinely applies and is genuinely violated. HELD, kept.
- **Swapped latitude/longitude** (6): re-verified by computing, for each of the 6, whether *swapping* the two fields lands them inside this dataset's normal coordinate range (lat ∈ [28.2,28.7], long ∈ [76.7,77.3], derived from the other ~3494 records). All 6 land squarely inside the normal range when swapped, and all 6 are squarely outside it as given. This is a clean, unambiguous, internally-contradictory record (can't be in a named Delhi-NCR locality and at those coordinates simultaneously). HELD, kept.
- **Implausible sub-₹30,000 price** (6): re-examined against the user's explicit standard. A positive price of ₹5,030–₹26,260, however absurd for the described property, is not a violation of any definitional or physical constraint — unlike the other four categories, there is no rule being broken, only an extreme improbability. (Multiplying by 1000 produces a price consistent with comparable listings, suggesting a likely scale/typo bug as the real-world cause — but the *cause* being probably-a-bug doesn't make the *given value* impossible the way -8,550,000 or floor 26-of-11 are.) **REMOVED per explicit instruction: "if implausible ... cannot establish impossibility, REMOVE".**
**Additional check:** tested one more candidate hard-constraint — `bathroom == 0` for non-`plot` property types (6 records, all also `bedroom: 0`) — a studio/bare-shell unit with zero recorded bathrooms doesn't violate a hard rule (bare-shell/warm-shell sales are a real Indian real-estate practice) and wasn't added.
**Cross-check:** confirmed zero overlap between the 24 final corrupt IDs and the Q9 fake-listing contact list, and no unusual `posted_by_contact` frequency pattern among the 24 — consistent with scattered data-entry/generation defects rather than a coordinated actor.
**Conclusion:** **Revised Q4 = 24 listing IDs** (removed the 6 sub-₹30k-price records).

## Q9 — fake listings: methodology sharpened, 230 → 95

**Hypothesis tested and refined:** "any contact (`posted_by_contact`) associated with more than one `posted_by_name`" (Phase C/D's rule; 12 contacts, 230 listings).
**Motivation:** the user explicitly flagged this rule as possibly too broad and asked for a natural breakpoint separating deliberate fraud from legitimate shared-contact scenarios.
**Test 1 (structural):** built a full phone→name cardinality table across all 593 contacts. Found a **hard discrete gap**: zero contacts have exactly 2 distinct names; every contact has either exactly 1 (581 contacts, up to 13 listings each) or 3-6 (12 contacts). A gradual, organic collision process would show a smooth decay (many at 2, fewer at 3, ...); a clean jump straight from 1 to 3+ is a structural signature of a deliberate name-pool mechanism, not incidental noise. This held for the full 12-contact set, regardless of listing volume.
**Test 2 (locality spread — tested and found weaker than assumed):** Phase C/D cited "6-10 distinct localities per hub contact" as corroborating evidence. Re-tested against a **fair baseline**: legitimate single-name contacts with comparable volume (≥10 listings) *also* average 6.85 distinct localities (vs. 8.33 for the multi-name group) — a real but much smaller gap than implied, confounded by listing volume (any busy agent, real or not, covers more ground). Downgraded from "corroborating evidence" to "weak, largely inconclusive."
**Test 3 (pricing — initially miscalculated, then corrected and found to be the decisive signal):** recomputing price/sqft with magichomes units corrected, and split by listing-volume tier, revealed a within-group discrepancy Phase C/D missed entirely: the 5 highest-volume contacts (18-35 listings each) price at **13,910/sqft — essentially exact market rate** (baseline 13,972); the other 7 contacts (13-14 listings each) price at **7,839/sqft — 44% below market**. This is the opposite of a smooth relationship with volume, so it isn't a volume artifact.
**Test 4 (name content — the disambiguating signal):** inspected the actual name lists behind the volume split. The 5 market-priced contacts use exclusively individual person names (e.g. "Shreya Iyer", "Nisha Kulkarni"). The 7 underpriced contacts mix person names with recognizable real-estate agency/company brand names ("Skyline Homes", "Prime Realty", "Crown Estates", "Elite Properties", "Metro Realtors", "Vertex Realty", "Star Housing", "Urban Nest", "Orbit Estates", "Nexus Properties", "Dream Space" — 11 such names exist in the entire dataset, and *every one* appears only as one of several rotating identities on a shared number, never as a single business's own consistent identity). Checked whether name choice correlates with which website carried the listing (would suggest an innocent per-portal placeholder-name artifact) — it does not, for any of the 12 contacts; the same contact uses different names on the same website and the same name across different websites, ruling out a portal-side explanation.
**Test 5 (confound check):** re-verified the pricing gap controlling for bedroom count (since unit-mix could confound a simple average). The 7 mixed-name contacts underprice by 44-46% in *every* bedroom bucket (1 through 5) versus the dataset-wide per-bedroom average; the 5 person-only contacts price within normal range in every bucket. Rules out a size/mix confound.
**Conclusion:** the person-only, market-priced group (5 contacts, 135 listings) shows a suspicious *identity* pattern but no economic behavior consistent with the assignment's specific definition of fake listings ("exist to generate enquiries") — a plausible innocent explanation exists (e.g. a shared team/call-center line with rotating staff credit) that the evidence doesn't rule out, so per the instruction to "return only IDs with strong evidence," these are **excluded**. The mixed-name, severely-underpriced group (7 contacts, 95 listings) shows both a structural anomaly (discrete multi-identity jump, plus rotating fake-sounding agency names never used consistently) and a clear behavioral motive matching the assignment's own definition (bait pricing to generate enquiries). **Revised Q9 = 95 listing IDs** (down from 230).
**Precision/recall estimate:** cannot be measured against ground truth (none available), but the two independent, bedroom-controlled signals (discrete name-pool structure + severe underpricing) agreeing on the same 7-contact/95-listing set is the strongest internally-consistent evidence available from this dataset. Recall risk: the person-only group (135 listings) may contain real fraud that just doesn't manifest as bait pricing — flagged as a residual uncertainty, not included.

## Q6 — recomputed downstream of Q4/Q9 revisions

**Test:** recomputed the mean of per-record `price/carpet_area` ratios (explicitly not `total_price/total_area`) using the revised Q4 (24) ∪ Q9 (95) = 119-record exclusion set, vs. the original Q4 (30) ∪ Q9 (230) = 260-record exclusion set, as a sensitivity check.
**Result:** 14425.01 (893 eligible records) vs. 14465.77 (844 eligible records) — a 0.28% difference, well inside the ±1% tolerance.
**Conclusion:** Q6 is **robust** to the Q4/Q9 revisions — reassuring, since it means the revised judgment calls on those two answers don't materially change this one. **Revised Q6 = 14425.01.**

## Q7 — exhaustively cross-checked, unchanged

**Test:** for every one of the 396 projects with ≥1 matching listing, compared the converted `price_max` (Lakh/Crore rule) against the actual maximum listing price found by joining on `project_id`. Then computed a maximally generous "robustness" figure per project: `max(converted price_max, actual observed max listing price)`.
**Result:** 159/396 projects show the actual joined max exceeding the converted declared max (consistent with the same stale-aggregate pattern behind Q10) — including the two Phase D outlier projects (P60090, P60273) whose declared `price_max` couldn't be cleanly resolved either way. Under the maximally generous robustness figure — which resolves every ambiguous case in whatever direction would make it *most* competitive — **P60060 still wins at exactly 58,300,000**, with the next-highest robustness figure well below it.
**Conclusion:** CONFIRMED, high confidence, robust to every reasonable resolution of the Lakh/Crore ambiguity. **Q7 unchanged: `{"project_id": "P60060", "price_max_inr": 58300000}`.**

## Q8 — explicit IST vs. UTC comparison, unchanged

**Test:** computed the Q8 count two ways: (A) compare the naive `posted_at` strings directly against the naive IST interval `[2026-09-03T00:00:00, 2026-09-10T00:00:00)` (the Phase D conclusion), and (B) treat the naive strings as UTC and convert the interval boundaries to their UTC-equivalents (`[2026-09-02T18:30:00, 2026-09-09T18:30:00)`).
**Result:** (A) IST interpretation = **129**. (B) UTC interpretation = **112**. The 17-record difference is exactly the set of listings with a raw "2026-09-09" timestamp between 18:30 and 24:00 — inspected all 19 records in that window directly. Under interpretation (B), these 19 records would sit *after* the UTC-equivalent generation cutoff (2026-09-09T18:30 UTC = REFERENCE), i.e. they shouldn't exist at all if that cutoff is real and listings are UTC — yet they do exist, cleanly and unremarkably, identical in every other respect to their neighbors. Under interpretation (A) they simply fall before midnight IST, consistent with everything else.
**Conclusion:** CONFIRMED, now with two independent lines of evidence (Phase D's full-day-coverage argument, plus this direct within-boundary-window contradiction test) both pointing the same way. **Q8 unchanged: 129.**

## Q10 — independently rejoined from scratch

**Test:** fresh join (not reusing Phase C/D code): grouped all listings by `project_id` (explicitly excluding the 1251 `null`-project_id listings from the join, verified none of the 2249 non-null `project_id` values reference a project outside the 400 retrieved), counted per project, compared to `project.total_listings`.
**Result:** project universe = exactly 400 (matches the full retrievable set from Phase C), 295 mismatches, 105 exact matches. Identical to Phase C/D.
**Conclusion:** CONFIRMED, unchanged. **Q10 unchanged: 295.**

## Files added in Phase E

- `analysis/scripts/validate.js` — self-contained independent re-derivation of all ten answers (does not import the Phase C/D `lib/` modules), writes `analysis/results/validated_answers.json`.
- `analysis/results/validated_answers.json` — the Phase E answer set, kept alongside the untouched Phase C/D `analysis/results/answers.json` for comparison.
