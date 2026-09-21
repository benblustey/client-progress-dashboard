import { getDashboardData } from "@/lib/sheets";
import { INTAKE_ROOT_TITLE, PHASES_ROOT_TITLE } from "@/lib/tree";
import Stepper from "@/components/Stepper";
import TreeAccordion from "@/components/TreeAccordion";
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

  // The "Project Phases" section is one combined stepper: the Intake
  // Checklist root itself as the first step, followed by each phase (the
  // "Project Phases" root's direct children) as the remaining steps. Any
  // other top-level branch added to the sheet later still gets its own
  // generic titled section below.
  const intakeRoot = data?.roots.find((r) => r.title === INTAKE_ROOT_TITLE);
  const phasesRoot = data?.roots.find((r) => r.title === PHASES_ROOT_TITLE);
  const steps = [...(intakeRoot ? [intakeRoot] : []), ...(phasesRoot?.children ?? [])];
  const otherRoots = data?.roots.filter((r) => r !== intakeRoot && r !== phasesRoot) ?? [];

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
          {steps.length > 0 && (
            <section className="mb-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-6 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {PHASES_ROOT_TITLE}
              </h2>
              <Stepper steps={steps} />
            </section>
          )}

          {otherRoots.map((root) => (
            <section key={root.id} className="mb-10">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {root.title}
              </h2>
              <TreeAccordion nodes={root.children} />
            </section>
          ))}

          <footer className="text-xs text-slate-400 dark:text-slate-600">
            Last updated {new Date(data!.fetchedAt).toLocaleString()}
          </footer>
        </>
      )}
    </main>
  );
}
