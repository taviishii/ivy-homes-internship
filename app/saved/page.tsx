import { redirect } from "next/navigation";
import { getAccessToken } from "@/lib/session";
import { getSaved } from "@/lib/ivy/saved";
import { ListingCard } from "@/components/ListingCard";
import { EmptyState } from "@/components/EmptyState";

export default async function SavedPage() {
  const session = await getAccessToken();
  if (!session) redirect("/login");

  let saved;
  let error: string | null = null;
  try {
    saved = await getSaved(session.token);
  } catch {
    error = "Couldn't load your saved listings right now. Please try again in a moment.";
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Saved listings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Listings you&apos;ve saved for {session.email}. Persists across reloads and logins.
        </p>
      </div>

      {error && <EmptyState title="Something went wrong" description={error} />}

      {!error && saved && saved.results.length === 0 && (
        <EmptyState
          title="No saved listings yet"
          description="Tap the heart icon on a listing to save it here."
        />
      )}

      {!error && saved && saved.results.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {saved.results.map((listing) => (
            <ListingCard key={listing.listing_id} listing={listing} saved={true} />
          ))}
        </div>
      )}
    </div>
  );
}
