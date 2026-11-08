"use client";

import { CheckCircle2, XCircle } from "lucide-react";

import type { PbipValidation } from "@/types/looker";

const CHECKS: { key: keyof PbipValidation; label: string }[] = [
  { key: "hasPbip", label: "PBIP found" },
  { key: "hasReportFolder", label: "Report assets found" },
  { key: "hasSemanticModelFolder", label: "Semantic Model found" },
];

/**
 * Client-side pre-flight check display. Purely a UX aid: the actual
 * pass/fail decision for the conversion itself is always made by the
 * backend, this only gives the user faster feedback before uploading.
 */
export function ValidationPanel({
  validation,
  selectedFileCount = 0,
}: {
  validation: PbipValidation;
  selectedFileCount?: number;
}) {
  if (validation.status === "idle") return null;

  const isValid = validation.status === "valid";

  return (
    <div
      className={
        isValid
          ? "rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20"
          : "rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40"
      }
    >
      <ul className="flex flex-col gap-2">
        {CHECKS.map(({ key, label }) => {
          const passed = Boolean(validation[key]);
          return (
            <li key={key} className="flex items-center gap-2 text-sm">
              {passed ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              )}
              <span className={passed ? "" : "text-red-800 dark:text-red-300"}>{label}</span>
            </li>
          );
        })}
      </ul>
      {!isValid ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {validation.hasPbip && selectedFileCount <= 1
            ? "Only the .pbip file was selected, without the assets that live alongside it. " +
              "Use \u201cSelect PBIP project\u201d (or drag the whole project folder) so those " +
              "assets come along automatically."
            : "Required project assets not found. Select the folder that contains your .pbip file."}
        </p>
      ) : null}
    </div>
  );
}
