import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = next && next.startsWith("/") ? next : "/listings";

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-16 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Ivy Homes
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Sign in to browse listings, rentals and projects.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <LoginForm nextPath={nextPath} />
        </div>
        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          Demo accounts: demo1@ivy.homes · demo2@ivy.homes · demo3@ivy.homes
        </p>
      </div>
    </div>
  );
}
