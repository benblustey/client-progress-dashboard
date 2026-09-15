"use client";

import { useState } from "react";
import type { Phase } from "@/lib/types";
import { phaseStatusClass, subtaskStatusClass } from "@/lib/statusColors";

interface MilestoneFlowProps {
  percentComplete: number;
  phases: Phase[];
  // Name of the phase to auto-expand on load — the "current" phase, i.e. the
  // first one not yet Complete. Computed server-side in app/page.tsx.
  defaultOpenPhase?: string;
}

type NodeState = "complete" | "active" | "blocked" | "upcoming";

const dotClasses: Record<NodeState, string> = {
  complete: "bg-emerald-500 border-emerald-500",
  active: "bg-sky-500 border-sky-500",
  blocked: "bg-rose-500 border-rose-500",
  upcoming: "bg-slate-200 border-slate-300 dark:bg-slate-700 dark:border-slate-600",
};

const lineClasses: Record<NodeState, string> = {
  complete: "bg-emerald-400",
  active: "bg-sky-300",
  blocked: "bg-rose-300",
  upcoming: "bg-slate-200 dark:bg-slate-700",
};

function phaseState(status: string): NodeState {
  switch (status) {
    case "Complete":
      return "complete";
    case "In Progress":
      return "active";
    case "Blocked":
      return "blocked";
    default:
      return "upcoming";
  }
}

function intakeState(percentComplete: number): NodeState {
  if (percentComplete >= 100) return "complete";
  if (percentComplete > 0) return "active";
  return "upcoming";
}

export default function MilestoneFlow({
  percentComplete,
  phases,
  defaultOpenPhase,
}: MilestoneFlowProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(defaultOpenPhase ? [defaultOpenPhase] : [])
  );

  function toggle(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  const intakeNodeState = intakeState(percentComplete);
  const numberedPhases = phases.map((phase, idx) => ({ phase, number: idx + 1 }));
  const openPhases = numberedPhases.filter(({ phase }) => expanded.has(phase.name));

  return (
    <div>
      <div className="w-full overflow-x-auto pb-2">
        <div className="flex min-w-[720px] flex-col gap-0 md:min-w-0 md:flex-row md:items-start">
          {/* Intake node — a status summary, not clickable (its detail lives in
              the "Intake Checklist by Category" section below). */}
          <div className="flex flex-1 flex-col items-center md:flex-row">
            <div className="flex flex-col items-center text-center md:w-40">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-4 text-sm font-semibold text-white ${dotClasses[intakeNodeState]}`}
                aria-hidden
              >
                {intakeNodeState === "complete" ? "✓" : "1"}
              </div>
              <div className="mt-2 text-sm font-semibold">Intake Checklist</div>
              <span className="mt-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {percentComplete}% complete
              </span>
            </div>
            <div
              className={`mx-2 my-2 h-1 flex-1 rounded md:my-0 md:h-1.5 ${lineClasses[intakeNodeState]}`}
              aria-hidden
            />
          </div>

          {/* Phase nodes — clickable, toggle that phase's sub-tasks below */}
          {numberedPhases.map(({ phase, number }, idx) => {
            const state = phaseState(phase.status);
            const isOpen = expanded.has(phase.name);
            const label = phase.name.replace(/^Phase\s*\d+\s*-\s*/, "");

            return (
              <div key={phase.name} className="flex flex-1 flex-col items-center md:flex-row">
                <button
                  type="button"
                  onClick={() => toggle(phase.name)}
                  aria-expanded={isOpen}
                  className="flex flex-col items-center rounded-md text-center transition hover:bg-slate-50 dark:hover:bg-slate-800/60 md:w-40"
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-4 text-sm font-semibold text-white ${dotClasses[state]}`}
                    aria-hidden
                  >
                    {state === "complete" ? "✓" : number}
                  </div>
                  <div className="mt-2 text-sm font-semibold">
                    Phase {number}: {label}
                  </div>
                  <span className={phaseStatusClass(phase.status)}>{phase.status}</span>
                </button>
                {idx < numberedPhases.length - 1 && (
                  <div
                    className={`mx-2 my-2 h-1 flex-1 rounded md:my-0 md:h-1.5 ${lineClasses[state]}`}
                    aria-hidden
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {openPhases.length > 0 && (
        <div className="mt-6 grid gap-3 border-t border-slate-100 pt-6 dark:border-slate-800 sm:grid-cols-2">
          {openPhases.map(({ phase, number }) => (
            <div
              key={phase.name}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Phase {number}: {phase.name.replace(/^Phase\s*\d+\s*-\s*/, "")}
              </p>
              <ul className="mt-2 space-y-2">
                {phase.tasks.length === 0 ? (
                  <li className="text-xs text-slate-400 dark:text-slate-600">
                    No sub-tasks listed yet.
                  </li>
                ) : (
                  phase.tasks.map((task) => (
                    <li key={task.name} className="flex items-start justify-between gap-2 text-xs">
                      <span className="text-slate-700 dark:text-slate-300">{task.name}</span>
                      <span className={subtaskStatusClass(task.status)}>{task.status}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
