import { useEffect, useState } from "react";
import { FieldLabel, inputStyle } from "@/components/marketizers/ui";
import { createBrand, updateBrand, type Brand } from "@/services/brands/brandService";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function BrandFormDrawer({
  initial,
  onClose,
  onSaved,
}: {
  initial: Partial<Brand> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<Partial<Brand>>(() => ({
    name: "", slug: "", color: "#C9973A", category: "", description: "",
    status: "active", include_in_sidebar: true, include_in_expense_allocation: true,
    sort_order: 100,
    ...initial,
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit && form.name && !form.slug) {
      setForm((f) => ({ ...f, slug: slugify(f.name || "") }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name]);

  const set = (k: keyof Brand, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setErr(null);
    if (!form.name?.trim()) return setErr("Name is required.");
    if (!form.slug?.trim()) return setErr("Slug is required.");
    setBusy(true);
    try {
      const payload: Partial<Brand> = {
        ...form,
        name: form.name.trim(),
        slug: slugify(form.slug),
        route_path: form.route_path || `/brands/${slugify(form.slug)}`,
      };
      if (isEdit && initial?.id) await updateBrand(initial.id, payload);
      else await createBrand(payload);
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={scrim} onClick={onClose}>
      <div style={drawer} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>
            {isEdit ? "Edit Brand" : "Add Brand"}
          </h3>
          <button className="btn-sm" onClick={onClose}>Close</button>
        </div>

        <div style={body}>
          {err && <div style={errBox}>{err}</div>}

          <Field label="Name">
            <input style={inputStyle} value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Slug (URL identifier)">
            <input style={inputStyle} value={form.slug ?? ""} onChange={(e) => set("slug", e.target.value)} placeholder="my-brand" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12 }}>
            <Field label="Color">
              <input type="color" style={{ ...inputStyle, padding: 4, height: 36 }} value={form.color ?? "#C9973A"} onChange={(e) => set("color", e.target.value)} />
            </Field>
            <Field label="Category">
              <input style={inputStyle} value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Photography" />
            </Field>
          </div>
          <Field label="Description">
            <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Status">
              <select style={inputStyle} value={form.status ?? "active"} onChange={(e) => set("status", e.target.value)}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Sort order">
              <input type="number" style={inputStyle} value={form.sort_order ?? 0} onChange={(e) => set("sort_order", Number(e.target.value || 0))} />
            </Field>
          </div>
          <Field label="Include in sidebar">
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" checked={!!form.include_in_sidebar} onChange={(e) => set("include_in_sidebar", e.target.checked)} />
              Show this brand in the left sidebar
            </label>
          </Field>
          <Field label="Include in expense allocation">
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" checked={!!form.include_in_expense_allocation} onChange={(e) => set("include_in_expense_allocation", e.target.checked)} />
              Allow shared expenses to be allocated to this brand
            </label>
          </Field>

          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
            <button className="btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn-sm btn-primary" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save brand"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}><FieldLabel>{label}</FieldLabel>{children}</div>;
}

const scrim: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(28,24,20,.42)", zIndex: 70, display: "flex", justifyContent: "flex-end" };
const drawer: React.CSSProperties = { width: "min(520px,100%)", height: "100%", background: "var(--ivory)", display: "flex", flexDirection: "column", overflow: "hidden" };
const head: React.CSSProperties = { padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" };
const body: React.CSSProperties = { padding: 22, overflowY: "auto", flex: 1 };
const errBox: React.CSSProperties = { background: "var(--red-bg)", color: "var(--red)", padding: "8px 12px", borderRadius: 6, fontSize: 12, marginBottom: 12 };
