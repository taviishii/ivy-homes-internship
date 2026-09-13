import { redirect } from "next/navigation";
import { getAccessToken } from "@/lib/session";
import { getInsights } from "@/lib/ivy/insights";
import { formatInr, formatInrCompact, formatLocality, formatBedroom } from "@/lib/ivy/format";
import { StatCard, BarList } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";

export default async function InsightsPage() {
  const session = await getAccessToken();
  if (!session) redirect("/login");

  let insights: Awaited<ReturnType<typeof getInsights>> | null = null;
  let error: string | null = null;
  try {
    insights = await getInsights(session.token);
  } catch {
    error = "Couldn't compute insights right now. Please try again in a moment.";
  }

  if (error || !insights) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Insights</h1>
        <EmptyState title="Something went wrong" description={error ?? undefined} />
      </div>
    );
  }

  const listingTotalGap = insights.listings.totalRetrievable - insights.listings.apiReportedTotal;
  const rentalTotalGap = insights.rentals.totalRetrievable - insights.rentals.apiReportedTotal;
  const projectTotalGap = insights.projects.totalRetrievable - insights.projects.apiReportedTotal;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Insights</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          The documented <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">/v1/analytics/summary</code> endpoint
          does not exist on the live API (confirmed 404, along with every plausible alternate path). Every number below is instead
          computed here from the full retrievable dataset, refreshed periodically.
        </p>
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          Computed {new Date(insights.computedAt).toLocaleString("en-IN")}
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Listings retrievable" value={insights.listings.totalRetrievable.toLocaleString("en-IN")} />
        <StatCard label="Active listings" value={insights.listings.activeCount.toLocaleString("en-IN")} sublabel={`${insights.listings.inactiveCount.toLocaleString("en-IN")} inactive`} />
        <StatCard label="Rentals retrievable" value={insights.rentals.totalRetrievable.toLocaleString("en-IN")} />
        <StatCard label="Projects retrievable" value={insights.projects.totalRetrievable.toLocaleString("en-IN")} />
        <StatCard
          label="Avg ₹/sqft (2 BHK, live)"
          value={`₹${Math.round(insights.listings.avgPricePerSqft2bhk).toLocaleString("en-IN")}`}
          sublabel="Excludes data-quality issues and suspected fake listings"
        />
        <StatCard label="Avg monthly rent" value={formatInr(Math.round(insights.rentals.avgMonthlyRent))} />
        <StatCard
          label="Recently posted"
          value={insights.listings.recentCount.toLocaleString("en-IN")}
          sublabel="7 days before the newest listing in the dataset"
        />
        {insights.projects.costliestProject && (
          <StatCard
            label="Costliest project"
            value={formatInrCompact(insights.projects.costliestProject.priceMaxInr)}
            sublabel={insights.projects.costliestProject.apartmentName}
          />
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Listings by locality</h2>
          <BarList
            items={insights.listings.byLocality}
            labelFor={(i) => formatLocality(i.locality as string)}
          />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Listings by bedroom count</h2>
          <BarList
            items={insights.listings.byBedroom}
            labelFor={(i) => formatBedroom(i.bedroom as number)}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">Verified discoveries about this API</h2>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          Found and reproduced during the investigation behind this app — not official API documentation.
        </p>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Discovery
            title="The API's own record counts are understated"
            detail={`The API reports ${insights.listings.apiReportedTotal.toLocaleString("en-IN")} listings, ${insights.rentals.apiReportedTotal.toLocaleString("en-IN")} rentals and ${insights.projects.apiReportedTotal.toLocaleString("en-IN")} projects, but ${listingTotalGap.toLocaleString("en-IN")}, ${rentalTotalGap.toLocaleString("en-IN")} and ${projectTotalGap.toLocaleString("en-IN")} more of each are actually retrievable by paging through to the end.`}
          />
          <Discovery
            title="Project listing counts are frequently wrong"
            detail={`${insights.projects.wrongListingCount} of ${insights.projects.totalRetrievable} projects report a total_listings figure that disagrees with an independent count of their actual listings.`}
          />
          <Discovery
            title="Data-quality issues identified"
            detail={`${insights.dataQuality.corruptListingsCount} listings describe something that cannot exist (e.g. a negative price, or a floor number higher than the building has) — excluded from the price statistics above.`}
          />
          <Discovery
            title="Suspected fake listings identified"
            detail={`${insights.dataQuality.fakeListingsCount} listings share a phone number with rotating fake seller identities and price well below market — also excluded above. See the README for the full methodology.`}
          />
        </dl>
      </section>
    </div>
  );
}

function Discovery({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <dt className="text-sm font-medium text-slate-800 dark:text-slate-200">{title}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{detail}</dd>
    </div>
  );
}
