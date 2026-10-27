// Marketizers ROAS — export helpers (CSV / PDF / WhatsApp).
// PDF uses jsPDF + jspdf-autotable. Inspired by IPC seminarRoasPdf, rebuilt for Marketizers.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { RoasSession, AudienceSegment } from "@/services/marketizers/roasService";
import { inr, dec, pct } from "./roasFormulas";

export function buildWhatsAppSummary(s: RoasSession): string {
  const lines = [
    "*SEMINAR / WEBINAR ROAS REPORT*",
    "",
    `Client: ${s.client_name ?? "-"}`,
    `Event: ${s.event_name ?? "-"}${s.event_type ? ` (${s.event_type})` : ""}`,
    s.campaign_date_to ? `Event Date: ${s.campaign_date_to}` : null,
    `Media Buyer: ${s.media_buyer_name ?? "-"}`,
    "",
    `Ad Spend: ₹${inr(s.ad_spend)}`,
    `Leads: ${inr(s.leads)}`,
    `CPL: ₹${inr(s.cpl ?? 0)}`,
    `Final Purchases: ${s.final_purchases}`,
    `Revenue: ₹${inr(s.total_revenue)}`,
    `ROAS: ${dec(s.roas ?? 0, 2)}x`,
    `PNL: ₹${inr(s.pnl ?? 0)}`,
    `Status: ${s.performance_health ?? "-"}`,
    s.notes ? "" : null,
    s.notes ? `Note: ${s.notes}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

export function exportRoasSessionCsv(s: RoasSession, segments: AudienceSegment[]) {
  const rows: [string, string | number][] = [
    ["Client", s.client_name ?? ""],
    ["Event Name", s.event_name ?? ""],
    ["Event Type", s.event_type ?? ""],
    ["Media Buyer", s.media_buyer_name ?? ""],
    ["Campaign Date From", s.campaign_date_from ?? ""],
    ["Campaign Date To", s.campaign_date_to ?? ""],
    ["Event Day Pattern", s.event_day_pattern ?? ""],
    ["Ad Spend", s.ad_spend],
    ["Leads", s.leads],
    ["CPL", Number(s.cpl ?? 0).toFixed(2)],
    ["CPP", Number(s.cpp ?? 0).toFixed(2)],
    ["Token Purchases", s.token_purchases],
    ["Final Purchases", s.final_purchases],
    ["Token Revenue", s.token_revenue],
    ["Final Revenue", s.final_revenue],
    ["Total Revenue", s.total_revenue],
    ["ROAS", Number(s.roas ?? 0).toFixed(2)],
    ["PNL", s.pnl ?? 0],
    ["Final Purchase Conversion", pct(Number(s.final_purchase_conversion ?? 0))],
    ["Revenue Per Lead", Number(s.revenue_per_lead ?? 0).toFixed(2)],
    ["Profit Per Lead", Number(s.profit_per_lead ?? 0).toFixed(2)],
    ["Show-up Count", s.showup_count ?? ""],
    ["Show-up %", pct(Number(s.showup_percent ?? 0))],
    ["Heard Count", s.heard_count ?? ""],
    ["Sales Count", s.sales_count ?? ""],
    ["Offer Show-up Count", s.offer_showup_count ?? ""],
    ["Offer Show-up %", pct(Number(s.offer_showup_percent ?? 0))],
    ["Health", s.performance_health ?? ""],
    ["Notes", (s.notes ?? "").replace(/\n/g, " ")],
  ];
  for (const seg of segments) {
    rows.push([
      `Audience: ${seg.segment_name}`,
      `${pct(Number(seg.segment_percentage ?? 0) / 100)} (${seg.segment_count ?? 0})`,
    ]);
  }
  const csv = rows
    .map(([k, v]) => `"${String(k).replace(/"/g, '""')}","${String(v).replace(/"/g, '""')}"`)
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `roas-${(s.event_name ?? "session").replace(/[^a-z0-9]+/gi, "-")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportRoasSessionPdf(s: RoasSession, segments: AudienceSegment[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Seminar / Webinar ROAS Report", margin, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(110);
  doc.text("Marketizers — Media Buyer Performance", margin, 68);
  doc.setTextColor(0);

  // Header block
  autoTable(doc, {
    startY: 90,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3 },
    body: [
      ["Client", s.client_name ?? "-", "Event Type", s.event_type ?? "-"],
      ["Event Name", s.event_name ?? "-", "Media Buyer", s.media_buyer_name ?? "-"],
      [
        "Campaign Window",
        `${s.campaign_date_from ?? "-"} → ${s.campaign_date_to ?? "-"}`,
        "Event Day Pattern",
        s.event_day_pattern ?? "-",
      ],
    ],
    columnStyles: {
      0: { fontStyle: "bold", textColor: 90, cellWidth: 90 },
      2: { fontStyle: "bold", textColor: 90, cellWidth: 90 },
    },
    margin: { left: margin, right: margin },
  });

  // Key metrics
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 18,
    head: [["Metric", "Value", "Metric", "Value"]],
    headStyles: { fillColor: [201, 151, 58], textColor: 255, fontSize: 10 },
    styles: { fontSize: 10, cellPadding: 4 },
    body: [
      ["Ad Spend", `₹${inr(s.ad_spend)}`, "Leads", inr(s.leads)],
      ["CPL", `₹${dec(Number(s.cpl ?? 0))}`, "CPP", `₹${dec(Number(s.cpp ?? 0))}`],
      [
        "Token Purchases",
        String(s.token_purchases),
        "Final Purchases",
        String(s.final_purchases),
      ],
      ["Total Revenue", `₹${inr(s.total_revenue)}`, "ROAS", `${dec(Number(s.roas ?? 0))}x`],
      ["PNL", `₹${inr(s.pnl ?? 0)}`, "Health", s.performance_health ?? "-"],
      [
        "Revenue / Lead",
        `₹${dec(Number(s.revenue_per_lead ?? 0))}`,
        "Profit / Lead",
        `₹${dec(Number(s.profit_per_lead ?? 0))}`,
      ],
    ],
    margin: { left: margin, right: margin },
  });

  // Funnel
  if (
    s.showup_count != null ||
    s.sales_count != null ||
    s.offer_showup_count != null ||
    s.heard_count != null
  ) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 18,
      head: [["Funnel", "Value"]],
      headStyles: { fillColor: [60, 60, 60], textColor: 255, fontSize: 10 },
      styles: { fontSize: 10, cellPadding: 4 },
      body: [
        ["Show-up", `${s.showup_count ?? 0} (${pct(Number(s.showup_percent ?? 0))})`],
        ["Heard", String(s.heard_count ?? 0)],
        ["Sales Count", String(s.sales_count ?? 0)],
        [
          "Offer Show-up",
          `${s.offer_showup_count ?? 0} (${pct(Number(s.offer_showup_percent ?? 0))})`,
        ],
        [
          "Final Purchase Conversion",
          pct(Number(s.final_purchase_conversion ?? 0)),
        ],
      ],
      margin: { left: margin, right: margin },
    });
  }

  // Audience
  if (segments.length) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 18,
      head: [["Audience Segment", "%", "Count"]],
      headStyles: { fillColor: [60, 60, 60], textColor: 255, fontSize: 10 },
      styles: { fontSize: 10, cellPadding: 4 },
      body: segments.map((seg) => [
        seg.segment_name,
        seg.segment_percentage != null ? `${seg.segment_percentage}%` : "-",
        String(seg.segment_count ?? "-"),
      ]),
      margin: { left: margin, right: margin },
    });
  }

  if (s.notes) {
    const y = (doc as any).lastAutoTable.finalY + 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Notes", margin, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(s.notes, 515);
    doc.text(lines, margin, y + 14);
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Generated ${new Date().toLocaleString()}`,
    margin,
    doc.internal.pageSize.getHeight() - 20,
  );

  doc.save(
    `roas-${(s.event_name ?? "session").replace(/[^a-z0-9]+/gi, "-")}.pdf`,
  );
}

export function exportRoasHistoryCsv(rows: RoasSession[]) {
  const headers = [
    "Event Date",
    "Client",
    "Event Type",
    "Event Name",
    "Media Buyer",
    "Ad Spend",
    "Leads",
    "Final Purchases",
    "Revenue",
    "ROAS",
    "PNL",
    "Health",
  ];
  const lines = [headers.join(",")];
  for (const s of rows) {
    lines.push(
      [
        s.campaign_date_to ?? "",
        s.client_name ?? "",
        s.event_type ?? "",
        s.event_name ?? "",
        s.media_buyer_name ?? "",
        s.ad_spend,
        s.leads,
        s.final_purchases,
        s.total_revenue,
        Number(s.roas ?? 0).toFixed(2),
        s.pnl ?? 0,
        s.performance_health ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `roas-history-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
