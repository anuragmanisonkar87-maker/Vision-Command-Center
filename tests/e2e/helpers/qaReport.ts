/**
 * Lightweight in-memory step recorder + markdown writer for the employee
 * daily-ops QA spec. No external deps.
 */
import fs from "fs";
import path from "path";

export type StepStatus = "pass" | "fail" | "skip" | "warn";

type Step = {
  name: string;
  status: StepStatus;
  note?: string;
  screenshot?: string;
  at: string;
};

const steps: Step[] = [];

export function recordStep(
  name: string,
  status: StepStatus,
  opts: { note?: string; screenshot?: string } = {},
) {
  steps.push({
    name,
    status,
    note: opts.note,
    screenshot: opts.screenshot,
    at: new Date().toISOString(),
  });
}

export function writeReport(filePath: string, extra?: { limitations?: string[] }) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const icon: Record<StepStatus, string> = {
    pass: "✅",
    fail: "❌",
    skip: "⚪",
    warn: "⚠️",
  };
  const lines: string[] = [];
  lines.push("# Employee Daily Ops — Automated QA Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("| # | Status | Step | Notes | Screenshot |");
  lines.push("|---|---|---|---|---|");
  steps.forEach((s, i) => {
    const shot = s.screenshot ? `\`${path.basename(s.screenshot)}\`` : "—";
    const note = (s.note ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
    lines.push(`| ${i + 1} | ${icon[s.status]} ${s.status} | ${s.name} | ${note} | ${shot} |`);
  });
  if (extra?.limitations?.length) {
    lines.push("");
    lines.push("## Known limitations");
    extra.limitations.forEach((l) => lines.push(`- ${l}`));
  }
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

export function resetSteps() {
  steps.length = 0;
}

export function getSteps(): readonly Step[] {
  return steps;
}
