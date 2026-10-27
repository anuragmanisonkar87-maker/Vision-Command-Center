// Phase 3F — Discipline Automation Center automation settings.
// All toggles default to safe values. Auto-send is OFF by default.
// No cron yet — these flags are read-only contracts for a future scheduler.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export type DisciplineAutomationSettings = {
  auto_apply_penalties: boolean;       // default false
  auto_create_drafts: boolean;         // default true
  auto_send_emails: boolean;           // default false
  automation_time: string;             // "HH:MM", default "19:00"
  email_mode: "draft_only" | "auto_send_after_draft";
};

export const DEFAULT_DISCIPLINE_SETTINGS: DisciplineAutomationSettings = {
  auto_apply_penalties: false,
  auto_create_drafts: true,
  auto_send_emails: false,
  automation_time: "19:00",
  email_mode: "draft_only",
};

const SETTINGS_KEY = "discipline_automation";

export async function getDisciplineAutomationSettings(): Promise<DisciplineAutomationSettings> {
  try {
    const { data, error } = await db
      .from("delegation_settings")
      .select("settings")
      .eq("id", 1)
      .maybeSingle();
    if (error) return DEFAULT_DISCIPLINE_SETTINGS;
    const raw = (data?.settings ?? {})[SETTINGS_KEY] ?? {};
    return { ...DEFAULT_DISCIPLINE_SETTINGS, ...raw };
  } catch {
    return DEFAULT_DISCIPLINE_SETTINGS;
  }
}

export async function setDisciplineAutomationSettings(next: DisciplineAutomationSettings): Promise<void> {
  const { data: row, error: readErr } = await db
    .from("delegation_settings")
    .select("settings")
    .eq("id", 1)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  const merged = { ...(row?.settings ?? {}), [SETTINGS_KEY]: next };
  const { error } = await db
    .from("delegation_settings")
    .update({ settings: merged, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

export default function AutomationSettingsPanel({ isAdmin }: { isAdmin: boolean }) {
  const [s, setS] = useState<DisciplineAutomationSettings>(DEFAULT_DISCIPLINE_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getDisciplineAutomationSettings().then(setS).catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      await setDisciplineAutomationSettings(s);
      setMsg("Saved.");
    } catch (e: any) {
      setMsg(`Failed: ${e.message}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white border border-[#E8E5DE] rounded-xl p-6 space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500 font-medium">Automation</div>
        <div className="text-lg font-semibold text-stone-800">Automation Settings</div>
        <p className="text-xs text-stone-500 mt-1">
          Automatic sending is disabled by default. Enable only after testing one real email.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Toggle
          label="Auto-apply missed task penalties"
          help="Adds penalty points automatically each day."
          checked={s.auto_apply_penalties}
          disabled={!isAdmin}
          onChange={(v) => setS({ ...s, auto_apply_penalties: v })}
          testid="auto-apply-penalties"
        />
        <Toggle
          label="Auto-create missed task email drafts"
          help="Drafts are created daily — nothing is sent."
          checked={s.auto_create_drafts}
          disabled={!isAdmin}
          onChange={(v) => setS({ ...s, auto_create_drafts: v })}
          testid="auto-create-drafts"
        />
        <Toggle
          label="Auto-send missed task emails"
          help="Sends drafts via Resend. OFF for safety."
          checked={s.auto_send_emails}
          disabled={!isAdmin}
          onChange={(v) => setS({ ...s, auto_send_emails: v })}
          testid="auto-send-emails"
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-stone-800">Daily automation time</label>
          <input
            type="time"
            value={s.automation_time}
            disabled={!isAdmin}
            onChange={(e) => setS({ ...s, automation_time: e.target.value })}
            className="px-3 py-2 border border-stone-300 rounded-md text-sm w-40"
            data-testid="automation-time"
          />
          <span className="text-xs text-stone-500">Default 19:00.</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-stone-800">Email mode</label>
          <select
            value={s.email_mode}
            disabled={!isAdmin}
            onChange={(e) => setS({ ...s, email_mode: e.target.value as DisciplineAutomationSettings["email_mode"] })}
            className="px-3 py-2 border border-stone-300 rounded-md text-sm w-60"
            data-testid="email-mode"
          >
            <option value="draft_only">Draft only</option>
            <option value="auto_send_after_draft">Auto-send after draft</option>
          </select>
        </div>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={save}
            disabled={busy}
            data-testid="save-automation-settings"
            className="px-4 py-2 rounded-md bg-stone-900 text-white text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save settings"}
          </button>
          {msg && <span className="text-xs text-stone-600">{msg}</span>}
        </div>
      )}
    </div>
  );
}

function Toggle({
  label, help, checked, onChange, disabled, testid,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  testid?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        data-testid={testid}
        className="mt-1 h-4 w-4 rounded border-stone-300"
      />
      <span className="flex flex-col">
        <span className="text-sm font-medium text-stone-800">{label}</span>
        <span className="text-xs text-stone-500">{help}</span>
      </span>
    </label>
  );
}
