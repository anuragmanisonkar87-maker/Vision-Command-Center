// Ported from IPC Control Center; useAuth swapped for VC adapter.
import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/tasks/useTaskAuth";
import { Task, TaskSubmission, createSubmission, isValidUrl, updateTask } from "@/lib/tasks";

export default function SubmitTaskModal({
  task, onClose, onSubmitted,
}: {
  task: Task;
  onClose: () => void;
  onSubmitted: (s: TaskSubmission, updatedTask?: Task) => void;
}) {
  const { user, profile } = useAuth();
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!user || !profile) return;
    const trimmed = url.trim();
    if (!isValidUrl(trimmed)) { setErr("Enter a valid http(s) URL"); return; }
    setBusy(true); setErr(null);
    try {
      const s = await createSubmission(task.id, trimmed, note || null, { id: user.id, name: profile.full_name });
      let updated: Task | undefined;
      if (task.status !== "done" && task.status !== "review") {
        try {
          updated = await updateTask(task, { status: "review" }, { id: user.id, name: profile.full_name });
        } catch { /* non-fatal */ }
      }
      toast.success("Work submitted");
      onSubmitted(s, updated);
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Failed to submit");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[1400] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[440px] bg-white border border-line rounded-xl shadow-2xl">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div className="font-serif text-[17px] font-medium">Submit work</div>
          <button onClick={onClose} className="w-7 h-7 border border-line rounded-[7px] flex items-center justify-center hover:bg-off">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="text-[12px] text-muted-foreground truncate">For: <span className="text-black">{task.title}</span></div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Submission link</label>
            <input autoFocus value={url} onChange={(e) => { setUrl(e.target.value); setErr(null); }}
              placeholder="https://drive.google.com/..."
              className={`ipc-input !h-10 !text-[13px] w-full ${err ? "!border-[#DC2626]" : ""}`} />
            {err && <div className="text-[11px] text-[#DC2626] mt-1">{err}</div>}
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
              placeholder="Anything reviewer should know…"
              className="ipc-input !text-[13px] w-full" style={{ minHeight: 70, resize: "vertical" }} />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-line flex justify-end gap-2 bg-off/40">
          <button onClick={onClose} className="ipc-btn ipc-btn-ghost !text-xs">Cancel</button>
          <button onClick={submit} disabled={busy} className="ipc-btn ipc-btn-black !text-xs">
            {busy ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
