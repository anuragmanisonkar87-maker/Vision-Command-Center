import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/cookie-policy")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — PhotoLancer" },
      { name: "description", content: "How PhotoLancer uses cookies and similar technologies." },
      { property: "og:title", content: "Cookie Policy — PhotoLancer" },
      { property: "og:description", content: "What cookies PhotoLancer sets, why, and how to control them." },
    ],
  }),
  component: CookiePage,
});

const sections = [
  { id: "what", label: "1. What are cookies" },
  { id: "types", label: "2. Cookies we use" },
  { id: "control", label: "3. How to control cookies" },
  { id: "changes", label: "4. Changes" },
  { id: "contact", label: "5. Contact" },
];

function CookiePage() {
  return (
    <LegalLayout
      title="Cookie Policy"
      intro="This Cookie Policy explains what cookies are, which ones PhotoLancer uses, and how you can control them."
      lastUpdated="15 June 2026"
      sections={sections}
    >
      <section id="what">
        <h2>1. What are cookies</h2>
        <p>Cookies are small text files stored on your device by your browser when you visit a website. They help the site work, remember your preferences, and understand how it is used.</p>
      </section>

      <section id="types">
        <h2>2. Cookies we use</h2>
        <h3>Essential cookies</h3>
        <p>These are required to operate PhotoLancer. They keep you signed in, remember your consent choice, and protect against fraud. Essential cookies cannot be disabled.</p>
        <ul>
          <li><strong>pl_cookie_consent</strong> — remembers your cookie consent choice (1 year).</li>
          <li><strong>Auth session cookies</strong> — set by our authentication system to keep you signed in.</li>
        </ul>
        <h3>Analytics cookies (optional)</h3>
        <p>With your consent, we use analytics cookies to understand how visitors use PhotoLancer in aggregate. This helps us improve search, listings, and the booking flow. You can decline these at any time.</p>
        <h3>Third-party cookies</h3>
        <p>Pages that embed third-party content (such as a payment gateway checkout) may set cookies controlled by those third parties. Their use is governed by their own policies.</p>
      </section>

      <section id="control">
        <h2>3. How to control cookies</h2>
        <p>You can accept or decline non-essential cookies from the banner shown on your first visit. You can change your choice later by clearing the <code>pl_cookie_consent</code> cookie in your browser; the banner will appear again on your next visit.</p>
        <p>Most browsers also let you block or delete cookies from the settings menu. Blocking essential cookies will break parts of the Platform.</p>
      </section>

      <section id="changes">
        <h2>4. Changes</h2>
        <p>We may update this Cookie Policy from time to time. The "Last updated" date at the top of this page shows the most recent revision.</p>
      </section>

      <section id="contact">
        <h2>5. Contact</h2>
        <p>For questions about cookies, contact <a href="mailto:privacy@photolancer.in">privacy@photolancer.in</a>.</p>
      </section>
    </LegalLayout>
  );
}
