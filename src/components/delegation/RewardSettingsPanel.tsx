// Admin panel for configuring badge / reward settings.
import { useEffect, useState } from "react";
import {
  BADGE_DEFS,
  DEFAULT_REWARD_SETTINGS,
  getRewardSettings,
  saveRewardSettings,
  type RewardSettings,
  type BadgeKey,
} from "@/services/delegation/badgeService";

const KEYS = Object.keys(BADGE_DEFS) as BadgeKey[];

export default function RewardSettingsPanel() {
  const [settings, setSettings] = useState<RewardSettings>(DEFAULT_REWARD_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getRewardSettings()
      .then(setSettings)
      .catch(() => setSettings(DEFAULT_REWARD_SETTINGS))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await saveRewardSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="text-sm text-stone-500">Loading…</div>;

  return (
    <div className="bg-white border border-[#E8E5DE] rounded-xl p-4 space-y-3" data-testid="dg-reward-settings">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-stone-900">Badges & Rewards</div>
          <div className="text-xs text-stone-500">Configure who earns each badge. Reward labels are for recognition only.</div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="bg-stone-900 text-[#C8A84B] px-3 py-1.5 rounded-md text-xs hover:bg-stone-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-stone-500 border-b border-[#E8E5DE]">
              <th className="text-left py-2 pr-2">Badge</th>
              <th className="text-left py-2 px-2 w-20">Enabled</th>
              <th className="text-left py-2 px-2 w-32">Min approved</th>
              <th className="text-left py-2 px-2">Reward label</th>
            </tr>
          </thead>
          <tbody>
            {KEYS.map((k) => (
              <tr key={k} className="border-b border-[#F0EDE5] last:border-b-0">
                <td className="py-2 pr-2">
                  <div className="text-stone-900">{BADGE_DEFS[k].name}</div>
                  <div className="text-[11px] text-stone-500">{BADGE_DEFS[k].reason}</div>
                </td>
                <td className="py-2 px-2">
                  <input
                    type="checkbox"
                    checked={settings.enabled[k]}
                    onChange={(e) => setSettings({ ...settings, enabled: { ...settings.enabled, [k]: e.target.checked } })}
                  />
                </td>
                <td className="py-2 px-2">
                  <input
                    type="number"
                    value={settings.min_approved[k]}
                    onChange={(e) => setSettings({ ...settings, min_approved: { ...settings.min_approved, [k]: Number(e.target.value) || 0 } })}
                    className="ipc-input w-24"
                  />
                </td>
                <td className="py-2 px-2">
                  <input
                    type="text"
                    placeholder="e.g. ₹500 bonus / Certificate"
                    value={settings.reward_label[k]}
                    onChange={(e) => setSettings({ ...settings, reward_label: { ...settings.reward_label, [k]: e.target.value } })}
                    className="ipc-input w-full max-w-xs"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
