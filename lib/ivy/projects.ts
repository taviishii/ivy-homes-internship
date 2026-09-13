import { ivyFetch } from "./client";
import type { IvyCollection, Project } from "./types";
import { LISTINGS_PAGE_SIZE, IVY_MAX_LIMIT } from "./listings";

export interface ProjectsPage {
  projects: Project[];
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface ProjectFilters {
  locality?: string;
}

export async function getProjects(
  accessToken: string,
  filters: ProjectFilters,
  offset: number,
  limit: number = LISTINGS_PAGE_SIZE
): Promise<ProjectsPage> {
  const data = await ivyFetch<IvyCollection<Project>>("/v1/projects", {
    accessToken,
    params: {
      offset,
      limit: Math.min(limit, IVY_MAX_LIMIT),
      locality: filters.locality,
    },
  });

  const verified = filters.locality
    ? data.results.filter((p) => p.locality === filters.locality)
    : data.results;

  return { projects: verified, offset: data.offset, limit: data.limit, hasMore: data.has_more };
}
