import { redirect } from "next/navigation";
import { getAccessToken } from "@/lib/session";
import { getProjects } from "@/lib/ivy/projects";
import { LISTINGS_PAGE_SIZE } from "@/lib/ivy/listings";
import { ProjectFilterBar } from "@/components/ProjectFilterBar";
import { ProjectCard } from "@/components/ProjectCard";
import { PaginationControls } from "@/components/PaginationControls";
import { EmptyState } from "@/components/EmptyState";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getAccessToken();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const locality = one(sp.locality) || undefined;
  const offset = one(sp.offset) ? Math.max(0, Number(one(sp.offset))) : 0;

  let page: Awaited<ReturnType<typeof getProjects>> | null = null;
  let error: string | null = null;
  try {
    page = await getProjects(session.token, { locality }, offset);
  } catch {
    error = "Couldn't load projects right now. Please try again in a moment.";
  }

  const currentParams = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) =>
      v === undefined ? [] : Array.isArray(v) ? v.map((x) => [k, x] as [string, string]) : [[k, v] as [string, string]]
    )
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Projects</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Builder projects in your city. Prices are converted from the API&apos;s Lakh/Crore figures to full rupees.
        </p>
      </div>

      <ProjectFilterBar />

      {error && <EmptyState title="Something went wrong" description={error} />}

      {!error && page && page.projects.length === 0 && (
        <EmptyState title="No projects match this filter" description="Try clearing the locality filter." />
      )}

      {!error && page && page.projects.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {page.projects.map((project) => (
              <ProjectCard key={project.project_id} project={project} />
            ))}
          </div>
          <PaginationControls
            basePath="/projects"
            searchParams={currentParams}
            offset={page.offset}
            limit={LISTINGS_PAGE_SIZE}
            count={page.projects.length}
            hasMore={page.hasMore}
          />
        </>
      )}
    </div>
  );
}
