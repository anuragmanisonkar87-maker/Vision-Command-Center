// Employee due-date change request dialog.
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createDueDateRequest, getSettings, type DelegationSettings } from "@/services/delegation/delegationService";

export default function DueDateRequestDialog({
  taskId, userId, currentDueDate, onClose, onSubmitted,
}: {
  taskId: string;
  userId: string;
  currentDueDate: string | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { getSettings().then((s: DelegationSettings) => setReasons(s.delay_reasons ?? [])).catch(() => setReasons([])); }, []);

  const submit = async () => {
    if (!newDate) { alert("Pick a new due date."); return; }
    setSaving(true);
    try {
      await createDueDateRequest({
        task_id: taskId,
        requested_by: userId,
        current_due_date: currentDueDate,
        requested_due_date: newDate,
        delay_reason: reason || undefined,
        note: note || undefined,
      });
      onSubmitted();
    } catch (e) {
      alert((e as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[110] flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-xl border border-[#E8E5DE]" onClick={(e) => e.stopPropagation()} data-testid="dg-ddr-dialog">
        <div className="p-5 border-b border-[#E8E5DE] flex items-center justify-between">
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22 }} className="text-stone-900">Request due-date change</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="text-xs text-stone-500">Current due date: <strong>{currentDueDate ?? "—"}</strong></div>
          <label className="text-xs uppercase tracking-wide text-stone-500">New date</label>
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="dg-modal-input" data-testid="dg-ddr-date" />
          <label className="text-xs uppercase tracking-wide text-stone-500">Reason</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="dg-modal-input" data-testid="dg-ddr-reason">
            <option value="">—</option>
            {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <label className="text-xs uppercase tracking-wide text-stone-500">Note</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="dg-modal-input" />
        </div>
        <div className="p-5 border-t border-[#E8E5DE] flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-600">Cancel</button>
          <button onClick={submit} disabled={saving} className="bg-stone-900 text-[#C8A84B] px-4 py-2 rounded-lg text-sm" data-testid="dg-ddr-submit">
            {saving ? "Sending…" : "Send request"}
          </button>
        </div>
      </div>
    </div>
  );
}
