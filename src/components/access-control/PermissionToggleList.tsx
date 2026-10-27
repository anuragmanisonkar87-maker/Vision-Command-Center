// @ts-nocheck
// Permission toggle list — 7 toggles per spec.
export type PermissionState = {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
  finance: boolean;
  manage_access: boolean;
};

const DEFAULTS: { key: keyof PermissionState; label: string; help?: string }[] = [
  { key: "view", label: "View" },
  { key: "create", label: "Create" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete / Archive" },
  { key: "export", label: "Export" },
  { key: "finance", label: "Finance Visibility", help: "Required to view revenue, expenses, P&L." },
  { key: "manage_access", label: "Manage Access", help: "Can administer this Team Access Control panel." },
];

export function emptyPermissions(): PermissionState {
  return { view: true, create: false, edit: false, delete: false, export: false, finance: false, manage_access: false };
}

export function PermissionToggleList({
  value, onChange,
}: { value: PermissionState; onChange: (v: PermissionState) => void }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {DEFAULTS.map((p) => (
        <label key={p.key} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
          background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 7,
          cursor: "pointer",
        }}>
          <input
            type="checkbox"
            checked={value[p.key]}
            onChange={(e) => onChange({ ...value, [p.key]: e.target.checked })}
            style={{ width: 16, height: 16, flexShrink: 0, accentColor: "var(--gold3)" }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{p.label}</div>
            {p.help && <div style={{ fontSize: 11, color: "var(--ink4)", marginTop: 2 }}>{p.help}</div>}
          </div>
        </label>
      ))}
    </div>
  );
}
