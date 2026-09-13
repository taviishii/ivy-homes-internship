import type { Project } from "@/lib/ivy/types";
import { convertProjectPriceToInr, formatInrCompact, formatLocality, titleCase } from "@/lib/ivy/format";

export function ProjectCard({ project }: { project: Project }) {
  const priceMin = convertProjectPriceToInr(project.price_min);
  const priceMax = convertProjectPriceToInr(project.price_max);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h3 className="line-clamp-1 font-semibold text-slate-900 dark:text-slate-50">{project.apartment_name}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {project.developer_name} · {formatLocality(project.locality)}
        </p>
      </div>

      <p className="text-lg font-bold text-slate-900 dark:text-slate-50">
        {formatInrCompact(priceMin)} – {formatInrCompact(priceMax)}
      </p>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
        <span>
          {project.min_area_sqft.toLocaleString("en-IN")}–{project.max_area_sqft.toLocaleString("en-IN")} sqft
        </span>
        <span>{project.total_units.toLocaleString("en-IN")} units</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {titleCase(project.project_status)}
        </span>
        <span className="text-xs text-slate-400" title="As reported by the API — our investigation found this figure disagrees with an independent count for most projects.">
          {project.total_listings} listings reported
        </span>
      </div>
    </div>
  );
}
