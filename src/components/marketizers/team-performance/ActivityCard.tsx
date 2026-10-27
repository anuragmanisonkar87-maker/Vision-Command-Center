// Reusable activity card for any Position Module → Activity Hub.
// Visual language matches Vision Center Design B (ivory cards, gold accents).

import { Link } from "@tanstack/react-router";
import {
  STATUS_LABEL,
  STATUS_PILL_CLASS,
  type ActivityStatus,
} from "@/config/marketizersTeamPerformanceModules";

export type ActivityCardProps = {
  title: string;
  description: string;
  status: ActivityStatus;
  route?: string;
  primaryActionLabel?: string;
  secondaryLinks?: { label: string; route: string }[];
  disabled?: boolean;
};

export default function ActivityCard({
  title,
  description,
  status,
  route,
  primaryActionLabel,
  secondaryLinks,
  disabled,
}: ActivityCardProps) {
  const isInactive =
    disabled ||
    !route ||
    status === "coming_soon" ||
    status === "foundation_ready" ||
    status === "locked";

  const primaryLabel =
    primaryActionLabel ??
    (status === "coming_soon" || status === "foundation_ready"
      ? "Coming Soon"
      : status === "locked"
        ? "Restricted"
        : `Open ${title}`);

  return (
    <div
      className="panel"
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        opacity: isInactive ? 0.92 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <div
          style={{
            fontFamily: "'Cormorant Garamond',serif",
            fontSize: 18,
            fontWeight: 700,
            color: "var(--ink)",
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
        <span className={`status-pill ${STATUS_PILL_CLASS[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink3)",
          lineHeight: 1.55,
          flexGrow: 1,
        }}
      >
        {description}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {isInactive ? (
          <button
            className="btn-sm"
            disabled
            style={{ alignSelf: "flex-start", opacity: 0.7, cursor: "not-allowed" }}
          >
            {primaryLabel}
          </button>
        ) : (
          <Link to={route!} style={{ alignSelf: "flex-start" }}>
            <button className="btn-sm">{primaryLabel} →</button>
          </Link>
        )}

        {secondaryLinks && secondaryLinks.length > 0 && !isInactive && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 2 }}>
            {secondaryLinks.map((l) => (
              <Link
                key={l.label}
                to={l.route}
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: 10.5,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--gold)",
                  textDecoration: "none",
                  borderBottom: "1px dashed var(--gold-border)",
                  paddingBottom: 1,
                }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
