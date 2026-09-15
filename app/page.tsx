import { getDashboardData } from "@/lib/sheets";
import MilestoneFlow from "@/components/MilestoneFlow";
import CategoryBreakdown from "@/components/CategoryBreakdown";
import ThemeToggle from "@/components/ThemeToggle";

// Re-fetch from Google Sheets at most once per minute. This is a read-only
// dashboard, so we don't need every page load to hit the Sheets API.
export const revalidate = 60;

export default async function DashboardPage() {
  let data;
  let loadError: string | null = null;

  try {
    data = await getDashboardData();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Unknown error loading dashboard data.";
  }

  // The "current" phase for auto-expand: the first one not yet Complete, or
  // the last phase if everything is done.
  const activePhase =
    data?.phases.find((p) => p.status !== "Complete") ?? data?.phases.at(-1);
  // Log the data and active phase for debugging purposes. This will appear in the server logs.
  console.log("Data loaded:", data, "Active phase:", activePhase);
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy dark:text-white">
            {data?.client.projectName || data?.client.clientName || "Project"} Progress
          </h1>
          {data?.client.clientName && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {data.client.clientName}
              {data.client.targetLaunch ? ` · Target launch: ${data.client.targetLaunch}` : ""}
            </p>
          )}
        </div>
        <ThemeToggle />
      </header>

      {loadError ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          <p className="font-semibold">Couldn&apos;t load project data.</p>
          <p className="mt-1">{loadError}</p>
          <p className="mt-2 text-rose-700 dark:text-rose-400">
            Check that SPREADSHEET_ID and the Google service account credentials are set correctly,
            and that the sheet is shared with the service account&apos;s email.
          </p>
        </div>
      ) : (
        <>
          <section className="mb-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-6 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Milestones
            </h2>
            <MilestoneFlow
              percentComplete={data!.percentComplete}
              phases={data!.phases}
              defaultOpenPhase={activePhase?.name}
            />
          </section>

          <section className="mb-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Intake Checklist by Category
            </h2>
            <CategoryBreakdown categories={data!.categories} items={data!.items} />
          </section>

          <footer className="text-xs text-slate-400 dark:text-slate-600">
            Last updated {new Date(data!.fetchedAt).toLocaleString()}
          </footer>
        </>
      )}
    </main>
  );
}
