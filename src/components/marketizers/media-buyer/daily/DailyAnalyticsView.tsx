// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { fmtNum, inr } from "@/lib/mediaBuyer/helpers";

interface Props {
  onBack: () => void;
}

type ReportRow = {
  id: string; report_date: string; report_name: string;
  total_ad_spend: number; total_leads: number; overall_cpl: number | null;
  metric_template_id: string | null;
  _media_buyers?: { name: string; spend: number; leads: number; cpl: number | null; metrics: Record<string, any> }[];
  _ad_accounts?: string[];
  _template_name?: string | null;
};

export default function DailyAnalyticsView({ onBack }: Props) {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [buyer, setBuyer] = useState("");
  const [account, setAccount] = useState("");
  const [template, setTemplate] = useState("");
  const [metricKey, setMetricKey] = useState<string>("cpm");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: reports } = await (supabase as any)
        .from("daily_lead_reports").select("*")
        .eq("is_deleted", false)
        .order("report_date", { ascending: true })
        .limit(500);
      const ids = (reports || []).map((r: any) => r.id);
      let mbsByReport: Record<string, any[]> = {};
      let aaByMb: Record<string, any[]> = {};
      if (ids.length) {
        const { data: mbs } = await (supabase as any)
          .from("daily_lead_report_media_buyers")
          .select("id, report_id, media_buyer_name, total_ad_spend, total_leads, cpl")
          .in("report_id", ids);
        for (const m of (mbs || [])) (mbsByReport[m.report_id] ||= []).push(m);
        const mbIds = (mbs || []).map((m: any) => m.id);
        if (mbIds.length) {
          const { data: aas } = await (supabase as any)
            .from("daily_lead_report_ad_accounts")
            .select("report_media_buyer_id, ad_account_name, ad_spend, metrics")
            .in("report_media_buyer_id", mbIds);
          for (const a of (aas || [])) (aaByMb[a.report_media_buyer_id] ||= []).push(a);
        }
        for (const r of reports || []) {
          const mbs = mbsByReport[r.id] || [];
          (r as any)._media_buyers = mbs.map((m) => {
            const accs = aaByMb[m.id] || [];
            // average metrics across ad accounts
            const metricsAgg: Record<string, number[]> = {};
            for (const a of accs) {
              if (a.metrics) for (const k of Object.keys(a.metrics)) {
                const v = parseFloat(String(a.metrics[k]));
                if (!isNaN(v)) (metricsAgg[k] ||= []).push(v);
              }
            }
            const metrics: Record<string, number> = {};
            for (const k of Object.keys(metricsAgg)) {
              const arr = metricsAgg[k];
              metrics[k] = arr.reduce((s, v) => s + v, 0) / arr.length;
            }
            return {
              name: m.media_buyer_name,
              spend: Number(m.total_ad_spend),
              leads: Number(m.total_leads),
              cpl: m.cpl ? Number(m.cpl) : null,
              metrics,
            };
          });
          (r as any)._ad_accounts = mbs.flatMap((m) => (aaByMb[m.id] || []).map((a) => a.ad_account_name));
        }
      }
      // template names
      const tplIds = Array.from(new Set((reports || []).map((r: any) => r.metric_template_id).filter(Boolean)));
      if (tplIds.length) {
        const { data: tpls } = await (supabase as any)
          .from("daily_metric_templates").select("id, template_name").in("id", tplIds);
        const map = new Map((tpls || []).map((t: any) => [t.id, t.template_name]));
        for (const r of reports || []) (r as any)._template_name = map.get(r.metric_template_id) || null;
      }
      setRows(reports || []);
      // default range: last 7 dates
      if ((reports || []).length) {
        const dates = (reports || []).map((r: any) => r.report_date).sort();
        const tail = dates.slice(-7);
        if (tail.length) { setFrom(tail[0]); setTo(tail[tail.length - 1]); }
      }
      setLoading(false);
    })();
  }, []);

  const allBuyers = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => (r._media_buyers || []).forEach((m) => s.add(m.name)));
    return Array.from(s).sort();
  }, [rows]);
  const allAccounts = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => (r._ad_accounts || []).forEach((a) => a && s.add(a)));
    return Array.from(s).sort();
  }, [rows]);
  const allTemplates = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r._template_name && s.add(r._template_name!));
    return Array.from(s).sort();
  }, [rows]);
  const allMetrics = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => (r._media_buyers || []).forEach((m) => Object.keys(m.metrics || {}).forEach((k) => s.add(k))));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (from && r.report_date < from) return false;
    if (to && r.report_date > to) return false;
    if (template && r._template_name !== template) return false;
    if (buyer && !(r._media_buyers || []).some((m) => m.name === buyer)) return false;
    if (account && !(r._ad_accounts || []).some((a) => a === account)) return false;
    return true;
  }), [rows, from, to, template, buyer, account]);

  // Daily trend (sums per date, optionally filtered to a single buyer)
  const trend = useMemo(() => {
    const map = new Map<string, { date: string; spend: number; leads: number }>();
    for (const r of filtered) {
      const date = r.report_date;
      let spend = 0, leads = 0;
      if (buyer) {
        const m = (r._media_buyers || []).find((x) => x.name === buyer);
        if (m) { spend = m.spend; leads = m.leads; }
      } else {
        spend = Number(r.total_ad_spend) || 0;
        leads = Number(r.total_leads) || 0;
      }
      const cur = map.get(date) || { date, spend: 0, leads: 0 };
      cur.spend += spend; cur.leads += leads;
      map.set(date, cur);
    }
    return Array.from(map.values()).map((d) => ({ ...d, cpl: d.leads ? d.spend / d.leads : 0 })).sort((a, b) => a.date < b.date ? -1 : 1);
  }, [filtered, buyer]);

  // Buyer comparison
  const buyerComparison = useMemo(() => {
    const acc: Record<string, { name: string; spend: number; leads: number }> = {};
    for (const r of filtered) {
      for (const m of r._media_buyers || []) {
        if (buyer && m.name !== buyer) continue;
        const cur = acc[m.name] || { name: m.name, spend: 0, leads: 0 };
        cur.spend += m.spend; cur.leads += m.leads;
        acc[m.name] = cur;
      }
    }
    return Object.values(acc).map((x) => ({ ...x, cpl: x.leads ? x.spend / x.leads : 0 }));
  }, [filtered, buyer]);

  // Metric trend
  const metricTrend = useMemo(() => {
    const map = new Map<string, { date: string; sum: number; n: number }>();
    for (const r of filtered) {
      for (const m of r._media_buyers || []) {
        if (buyer && m.name !== buyer) continue;
        const v = m.metrics?.[metricKey];
        if (v == null || isNaN(v as any)) continue;
        const cur = map.get(r.report_date) || { date: r.report_date, sum: 0, n: 0 };
        cur.sum += Number(v); cur.n += 1;
        map.set(r.report_date, cur);
      }
    }
    return Array.from(map.values()).map((d) => ({ date: d.date, value: d.n ? d.sum / d.n : 0 })).sort((a, b) => a.date < b.date ? -1 : 1);
  }, [filtered, buyer, metricKey]);

  // Summary cards
  const summary = useMemo(() => {
    const t = trend.reduce((a, d) => ({ spend: a.spend + d.spend, leads: a.leads + d.leads }), { spend: 0, leads: 0 });
    const cpls = trend.filter((d) => d.cpl > 0).map((d) => d.cpl);
    const avgCpl = cpls.length ? cpls.reduce((a, b) => a + b, 0) / cpls.length : null;
    const sortedCpl = [...buyerComparison].filter((x) => x.cpl > 0).sort((a, b) => a.cpl - b.cpl);
    const sortedLeads = [...buyerComparison].sort((a, b) => b.leads - a.leads);
    return {
      ...t, avgCpl,
      bestCpl: sortedCpl[0] || null,
      topLeads: sortedLeads[0] || null,
    };
  }, [trend, buyerComparison]);

  const reset = () => { setBuyer(""); setAccount(""); setTemplate(""); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div className="step-title">Daily Reporting Analytics</div>
          <div className="step-sub">Visualize spend, leads, and CPL trends across dates and media buyers.</div>
        </div>
        <button className="btn btn-g btn-sm" onClick={onBack}>← Back to History</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 14, padding: 12, background: "#F7F6F3", border: "1px solid #E8E5DE", borderRadius: 10 }}>
        <div><label className="fl-sm">From</label><input type="date" className="fi-sm" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="fl-sm">To</label><input type="date" className="fi-sm" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <label className="fl-sm">Media Buyer</label>
          <select className="fi-sm" value={buyer} onChange={(e) => setBuyer(e.target.value)}>
            <option value="">All</option>
            {allBuyers.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="fl-sm">Ad Account</label>
          <select className="fi-sm" value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="">All</option>
            {allAccounts.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="fl-sm">Template</label>
          <select className="fi-sm" value={template} onChange={(e) => setTemplate(e.target.value)}>
            <option value="">All</option>
            {allTemplates.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="fl-sm">Metric</label>
          <select className="fi-sm" value={metricKey} onChange={(e) => setMetricKey(e.target.value)}>
            {allMetrics.length ? allMetrics.map((m) => <option key={m} value={m}>{m}</option>) : <option value="">No metrics</option>}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "end" }}>
          <button className="btn btn-g btn-sm" onClick={reset}>Reset filters</button>
        </div>
      </div>

      <div className="sum-row" style={{ marginBottom: 18 }}>
        <div className="sum-card plain"><div className="sum-lbl">Total Spend</div><div className="sum-val">{inr(summary.spend)}</div></div>
        <div className="sum-card plain"><div className="sum-lbl">Total Leads</div><div className="sum-val">{fmtNum(summary.leads)}</div></div>
        <div className="sum-card gold"><div className="sum-lbl">Average CPL</div><div className="sum-val">{summary.avgCpl == null ? "—" : inr(summary.avgCpl)}</div></div>
        <div className="sum-card plain"><div className="sum-lbl">Best CPL Buyer</div><div className="sum-val" style={{ fontSize: 16 }}>{summary.bestCpl ? `${summary.bestCpl.name} · ${inr(summary.bestCpl.cpl)}` : "—"}</div></div>
        <div className="sum-card plain"><div className="sum-lbl">Top Leads Buyer</div><div className="sum-val" style={{ fontSize: 16 }}>{summary.topLeads ? `${summary.topLeads.name} · ${fmtNum(summary.topLeads.leads)}` : "—"}</div></div>
      </div>

      {loading ? <div style={{ color: "#888" }}>Loading…</div> : trend.length === 0 ? (
        <div style={{ background: "#F7F6F3", border: "1px solid #E8E5DE", borderRadius: 10, padding: 24, textAlign: "center" }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18 }}>No data available for selected filters</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 14 }}>
          <ChartCard title="Daily Spend Trend">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E5DE" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
                <Tooltip /><Line type="monotone" dataKey="spend" stroke="#0a0a0a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Daily Leads Trend">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E5DE" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
                <Tooltip /><Line type="monotone" dataKey="leads" stroke="#C8A84B" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Daily CPL Trend">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E5DE" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
                <Tooltip /><Line type="monotone" dataKey="cpl" stroke="#16A34A" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Media Buyer CPL Comparison">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={buyerComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E5DE" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
                <Tooltip /><Bar dataKey="cpl" fill="#C8A84B" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Media Buyer Spend">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={buyerComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E5DE" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
                <Tooltip /><Bar dataKey="spend" fill="#0a0a0a" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Media Buyer Leads">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={buyerComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E5DE" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
                <Tooltip /><Bar dataKey="leads" fill="#C8A84B" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {metricKey && metricTrend.length > 0 && (
            <ChartCard title={`Metric Trend — ${metricKey}`}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={metricTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E5DE" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
                  <Tooltip /><Line type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E8E5DE", borderRadius: 12, padding: 14 }}>
      <div style={{ fontFamily: "'Jost',sans-serif", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".12em", color: "#888", marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}
