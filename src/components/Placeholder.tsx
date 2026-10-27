import { useEffect } from "react";

type Props = {
  eyebrow: string;
  title: string;
  message: string;
  icon?: string;
  documentTitle?: string;
};

export function Placeholder({ eyebrow, title, message, icon = "✦", documentTitle }: Props) {
  useEffect(() => {
    if (documentTitle) document.title = documentTitle;
  }, [documentTitle]);

  return (
    <div>
      <div style={{ marginBottom: 32, animation: "fadeUp .55s ease both" }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>{eyebrow}</div>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond',serif",
            fontSize: "clamp(32px, 3vw, 44px)",
            fontWeight: 700,
            color: "var(--ink)",
            lineHeight: 1.1,
            letterSpacing: "-.02em",
          }}
        >
          {title}
        </h1>
      </div>

      <div className="panel" style={{ animation: "fadeUp .55s .08s ease both" }}>
        <div
          className="panel-body"
          style={{ padding: "56px 40px", textAlign: "center" }}
        >
          <div
            style={{
              fontSize: 36,
              color: "var(--gold3)",
              marginBottom: 18,
              opacity: 0.85,
            }}
          >
            {icon}
          </div>
          <div
            style={{
              fontFamily: "'Cormorant Garamond',serif",
              fontSize: 22,
              fontWeight: 700,
              color: "var(--ink)",
              marginBottom: 8,
            }}
          >
            This module is being built
          </div>
          <p
            style={{
              fontSize: 13.5,
              color: "var(--ink3)",
              maxWidth: 440,
              margin: "0 auto",
              lineHeight: 1.7,
            }}
          >
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
