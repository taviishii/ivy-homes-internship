// Q9: listings deliberately posted to generate enquiries rather than
// describe a real, available property. See INVESTIGATION_LOG.md
// "Fake listings (Q9)" for the full derivation and robustness checks.
//
// Signal: a phone number (posted_by_contact) associated with more than one
// distinct posted_by_name. In this dataset, 581/593 contacts (98%) keep a
// single consistent name even at volumes up to 13 listings — real sellers
// keep one identity. The 12 exceptions each cycle through 3-6 different
// names, span nearly every locality and multiple property types (unlike a
// genuine agent who specializes), and price ~19% below the dataset average
// — consistent with a lead-generation operation running fake "different
// seller" identities behind one real contact number.
"use strict";

function findFakeListingIds(listings) {
  const namesByContact = new Map();
  for (const l of listings) {
    if (!namesByContact.has(l.posted_by_contact)) namesByContact.set(l.posted_by_contact, new Set());
    namesByContact.get(l.posted_by_contact).add(l.posted_by_name);
  }

  const multiNameContacts = new Set([...namesByContact.entries()].filter(([, names]) => names.size > 1).map(([c]) => c));

  const ids = new Set();
  for (const l of listings) {
    if (multiNameContacts.has(l.posted_by_contact)) ids.add(l.listing_id);
  }
  return { ids, multiNameContacts };
}

module.exports = { findFakeListingIds };
