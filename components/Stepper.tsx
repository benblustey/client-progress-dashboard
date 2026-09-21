"use client";

import { useState } from "react";
import type { TreeNode } from "@/lib/types";
import { computeRollup } from "@/lib/tree";
import { rollupBadgeClass, stepperDotClasses, stepperLineClasses } from "@/lib/statusColors";
import { TreeLevel } from "./TreeAccordion";

interface StepperProps {
  // Any sequence of top-level nodes to show as connected steps — today
  // that's [Intake Checklist, ...Project Phases's children], in that order.
  steps: TreeNode[];
}

// Horizontal connected-dot stepper, PLUS a full row list of those same steps
// underneath it — every step is always visible as a row, not just the open
// ones. Clicking a dot up top and clicking its row below both toggle the
// exact same shared open/closed state, so either one expands that step's
// children in place (via the generic TreeLevel, so a step can nest
// sub-tasks to whatever depth the sheet defines).
export default function Stepper({ steps }: StepperProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const firstIncomplete = steps.find((s) => computeRollup(s).state !== "complete");
    const defaultStep = firstIncomplete ?? steps.at(-1);
    return new Set(defaultStep ? [defaultStep.id] : []);
  });

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const numberedSteps = steps.map((step, idx) => ({ step, number: idx + 1 }));

  return (
    <div>
      <div className="w-full overflow-x-auto pb-2">
        <div className="flex min-w-[720px] flex-col gap-0 md:min-w-0 md:flex-row md:items-start">
          {numberedSteps.map(({ step, number }, idx) => {
            const rollup = computeRollup(step);
            const isOpen = expanded.has(step.id);
            // Strips a "Phase N - " prefix when present; a no-op on titles
            // that don't have one, like "Intake Checklist".
            const label = step.title.replace(/^Phase\s*\d+\s*-\s*/, "");

            return (
              <div key={step.id} className="flex flex-1 flex-col items-center md:flex-row">
                <button
                  type="button"
                  onClick={() => toggle(step.id)}
                  aria-expanded={isOpen}
                  className="flex flex-col items-center rounded-md text-center transition hover:bg-slate-50 dark:hover:bg-slate-800/60 md:w-40"
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-4 text-sm font-semibold text-white ${stepperDotClasses[rollup.state]}`}
                    aria-hidden
                  >
                    {rollup.state === "complete" ? "✓" : number}
                  </div>
                  <div className="mt-2 text-sm font-semibold">{label}</div>
                  <span className={rollupBadgeClass(rollup.state)}>
                    {rollup.total > 0 ? `${rollup.completed}/${rollup.total}` : "No sub-tasks"}
                  </span>
                </button>
                {idx < numberedSteps.length - 1 && (
                  <div
                    className={`mx-2 my-2 h-1 flex-1 rounded md:my-0 md:h-1.5 ${stepperLineClasses[rollup.state]}`}
                    aria-hidden
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 border-t border-slate-100 pt-6 dark:border-slate-800">
        <TreeLevel nodes={steps} expanded={expanded} toggle={toggle} depth={0} />
      </div>
    </div>
  );
}
