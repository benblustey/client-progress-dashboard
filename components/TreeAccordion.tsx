"use client";

import { useState } from "react";
import type { TreeNode } from "@/lib/types";
import { leafStatusClass, rollupBadgeClass } from "@/lib/statusColors";
import { computeRollup, normalizeStatus } from "@/lib/tree";

interface TreeAccordionProps {
  nodes: TreeNode[];
  // Depth to render the top level of `nodes` at. Defaults to 0 (the bordered
  // "card" look used for top-level sections like Intake Checklist). Callers
  // embedding this inside another card — e.g. PhaseStepper's expanded phase
  // panel — pass 1 so the nesting doesn't add a second layer of card chrome.
  startDepth?: number;
}

// Generic recursive expand/collapse tree. Renders any depth: leaves show
// their entered status, list nodes show a computed rollup (count + percent)
// and expand to reveal their children, which may themselves be leaves or
// further list nodes. Starts fully collapsed.
export default function TreeAccordion({ nodes, startDepth = 0 }: TreeAccordionProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  return <TreeLevel nodes={nodes} expanded={expanded} toggle={toggle} depth={startDepth} />;
}

// Exported so other components (e.g. Stepper) can embed the same recursive
// rendering while sharing their own expand/collapse state with it, instead
// of each getting an independent, unsynced copy.
export function TreeLevel({
  nodes,
  expanded,
  toggle,
  depth,
}: {
  nodes: TreeNode[];
  expanded: Set<string>;
  toggle: (id: string) => void;
  depth: number;
}) {
  return (
    <ul
      className={
        depth === 0
          ? "space-y-2"
          : "mt-2 space-y-2 border-l border-slate-100 pl-4 dark:border-slate-800"
      }
    >
      {nodes.map((node) => {
        const isLeaf = node.children.length === 0;
        const isOpen = expanded.has(node.id);

        if (isLeaf) {
          return (
            <li key={node.id}>
              <div className="flex items-start justify-between gap-2 rounded-md px-2 py-1.5 text-xs">
                <span className="text-slate-700 dark:text-slate-300">{node.title}</span>
                <span className={leafStatusClass(node.status)}>{normalizeStatus(node.status)}</span>
              </div>
            </li>
          );
        }

        const rollup = computeRollup(node);

        return (
          <li key={node.id}>
            <div
              className={
                depth === 0
                  ? "rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                  : ""
              }
            >
              <button
                type="button"
                onClick={() => toggle(node.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <span
                  className={
                    depth === 0
                      ? "text-sm font-medium"
                      : "text-xs font-medium text-slate-700 dark:text-slate-300"
                  }
                >
                  {node.title}
                </span>
                <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  {rollup.total > 0 ? `${rollup.completed}/${rollup.total}` : "—"}
                  <span className={rollupBadgeClass(rollup.state)}>{rollup.percent}%</span>
                  <span
                    className={`inline-block transition-transform ${isOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  >
                    ▾
                  </span>
                </span>
              </button>
              {depth === 0 && (
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-brand-navy transition-all"
                    style={{ width: `${rollup.percent}%` }}
                  />
                </div>
              )}
              {isOpen && (
                <TreeLevel nodes={node.children} expanded={expanded} toggle={toggle} depth={depth + 1} />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
