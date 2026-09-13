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

## Requests used this session

~90 requests logged in `analysis/log/requests.jsonl` (gitignored) during Phase A/B — all against documented + a small number of plausible undocumented paths, well under the 1200/min rate limit and the ~150-request full-dataset estimate for Phase C.
