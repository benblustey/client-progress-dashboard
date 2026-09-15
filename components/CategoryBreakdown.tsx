"use client";

import { useState } from "react";
import type { CategorySummary, ChecklistItem } from "@/lib/types";
import { checklistStatusClass } from "@/lib/statusColors";

interface CategoryBreakdownProps {
  categories: CategorySummary[];
  items: ChecklistItem[];
}

export default function CategoryBreakdown({ categories, items }: CategoryBreakdownProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(category: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  return (
    <div className="grid gap-3 grid-cols-1">
      {categories.map((cat) => {
        const pct = cat.total > 0 ? Math.round((cat.done / cat.total) * 100) : 0;
        const isOpen = expanded.has(cat.category);
        const categoryItems = items.filter(
          (item) => (item.category || "Uncategorized") === cat.category
        );

        return (
          <div
            key={cat.category}
            className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <button
              type="button"
              onClick={() => toggle(cat.category)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-sm font-medium">{cat.category}</span>
              <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                {cat.done}/{cat.total}
                <span
                  className={`inline-block transition-transform ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden
                >
                  ▾
                </span>
              </span>
            </button>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-brand-navy transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            {isOpen && (
              <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                {categoryItems.map((item) => (
                  <li key={item.item} className="flex items-start justify-between gap-2 text-xs">
                    <span className="text-slate-700 dark:text-slate-300">{item.item}</span>
                    <span className={checklistStatusClass(item.status)}>{item.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
