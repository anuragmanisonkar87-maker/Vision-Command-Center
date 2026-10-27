import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — PhotoLancer" },
      { name: "description", content: "How PhotoLancer collects, uses, shares, and protects your personal data, and how to request deletion." },
      { property: "og:title", content: "Privacy Policy — PhotoLancer" },
      { property: "og:description", content: "Read how PhotoLancer handles your data, third-party services, cookies, and your privacy rights under Indian law." },
    ],
  }),
  component: PrivacyPage,
});

const sections = [
  { id: "overview", label: "1. Overview" },
  { id: "what-we-collect", label: "2. Data we collect" },
  { id: "how-we-use", label: "3. How we use data" },
  { id: "third-parties", label: "4. Third parties we share with" },
  { id: "cookies", label: "5. Cookies" },
  { id: "rights", label: "6. Your rights" },
  { id: "deletion", label: "7. Account & data deletion" },
  { id: "retention", label: "8. Retention" },
  { id: "security", label: "9. Security" },
  { id: "children", label: "10. Children" },
  { id: "changes", label: "11. Changes to this policy" },
  { id: "contact", label: "12. Contact" },
];

function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro="This Privacy Policy explains what personal data PhotoLancer collects, how we use it, who we share it with, and how you can exercise your rights under Indian law, including the Digital Personal Data Protection Act, 2023."
      lastUpdated="15 June 2026"
      sections={sections}
    >
      <section id="overview">
        <h2>1. Overview</h2>
        <p>PhotoLancer ("we", "us", "our") operates a marketplace that connects clients with photographers, studios, and second shooters in India. We act as a <strong>Data Fiduciary</strong> in respect of the personal data we collect about you.</p>
      </section>

      <section id="what-we-collect">
        <h2>2. Data we collect</h2>
        <h3>Profile and contact information</h3>
        <ul>
          <li>Name, email address, mobile number;</li>
          <li>For photographers and studios: profile photo, bio, city, specialities, sample work, pricing, availability, and business details such as GSTIN if provided;</li>
          <li>For clients: event details required to fulfil a booking.</li>
        </ul>
        <h3>Payment metadata</h3>
        <p>We do <strong>not</strong> store full card or bank details on our servers. Payments are processed by a regulated Indian payment gateway. We retain payment metadata such as transaction ID, status, amount, currency, masked instrument, and timestamps for accounting, escrow, refunds, and audit.</p>
        <h3>Usage data</h3>
        <p>Device type, browser, IP address, pages visited, searches, click data, and basic diagnostics, collected via cookies, server logs, and analytics tools.</p>
        <h3>Communications</h3>
        <p>Messages exchanged between clients and photographers via the Platform, as well as support tickets and feedback you send to us.</p>
        <h3>Social sign-in</h3>
        <p>If you sign in via Google or Meta (Instagram/Facebook), we receive basic profile information (name, email, profile photo) from those providers in accordance with the permissions you grant.</p>
      </section>

      <section id="how-we-use">
        <h2>3. How we use data</h2>
        <ul>
          <li>To create and manage your account and verify identity;</li>
          <li>To operate listings, search, bookings, escrow, and payouts;</li>
          <li>To process payments, refunds, and dispute resolution;</li>
          <li>To send transactional messages such as booking confirmations, reminders, and payout notices;</li>
          <li>To send marketing communications about PhotoLancer features and Featured listing opportunities, which you can opt out of at any time;</li>
          <li>To prevent fraud, abuse, and breach of our Terms;</li>
          <li>To comply with legal obligations, including tax and KYC requirements.</li>
        </ul>
      </section>

      <section id="third-parties">
        <h2>4. Third parties we share with</h2>
        <ul>
          <li><strong>Payment gateway</strong> (e.g. Razorpay) — to process booking payments, payouts, and refunds.</li>
          <li><strong>Cloud hosting providers</strong> — to host the Platform and store data securely.</li>
          <li><strong>Analytics providers</strong> — to understand how the Platform is used in aggregate.</li>
          <li><strong>Email and notification providers</strong> — to deliver transactional messages.</li>
          <li><strong>Identity providers</strong> — Google and Meta, only if you choose to sign in with them.</li>
          <li><strong>Law enforcement and regulators</strong> — where required by Indian law or a valid legal order.</li>
        </ul>
        <p>We do not sell your personal data.</p>
      </section>

      <section id="cookies">
        <h2>5. Cookies</h2>
        <p>We use essential cookies to keep you signed in, remember your consent preferences, and operate the Platform. With your consent we also use analytics cookies. For details, see our <a href="/cookie-policy">Cookie Policy</a>.</p>
      </section>

      <section id="rights">
        <h2>6. Your rights</h2>
        <p>Subject to applicable law, you have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you;</li>
          <li>Correct inaccurate or incomplete data;</li>
          <li>Request erasure of your data, subject to record-keeping obligations;</li>
          <li>Withdraw consent for optional processing such as marketing;</li>
          <li>Nominate a person to exercise your rights in case of death or incapacity;</li>
          <li>File a grievance with our Grievance Officer (see Contact).</li>
        </ul>
      </section>

      <section id="deletion">
        <h2>7. Account &amp; data deletion</h2>
        <p>You may request deletion of your PhotoLancer account and associated personal data at any time. There are two ways to do this:</p>
        <ol>
          <li><strong>From the app:</strong> sign in, go to <em>Settings → Account → Delete account</em>, and confirm. Active bookings must be completed or cancelled first.</li>
          <li><strong>By email:</strong> write to <a href="mailto:privacy@photolancer.in">privacy@photolancer.in</a> from the email address registered on your account, with the subject line <em>"Delete my account"</em>. We will respond within 30 days.</li>
        </ol>
        <p>Once we process your request, we will delete or anonymise your personal data, except where we are required to retain it under tax, accounting, or anti-fraud laws (typically for up to 8 years).</p>
        <p>If you signed up via Instagram or Facebook, you can also revoke PhotoLancer's access from your Meta account settings; this stops further data sharing but does not by itself delete your PhotoLancer account.</p>
      </section>

      <section id="retention">
        <h2>8. Retention</h2>
        <p>We retain personal data only for as long as needed to provide the Platform and to comply with our legal obligations. Booking and payment records are retained for up to 8 years from the end of the relevant financial year for tax and audit purposes.</p>
      </section>

      <section id="security">
        <h2>9. Security</h2>
        <p>We use industry-standard safeguards including encryption in transit, access controls, and regular reviews. No system is perfectly secure; please use a strong password and notify us immediately if you suspect unauthorised access.</p>
      </section>

      <section id="children">
        <h2>10. Children</h2>
        <p>PhotoLancer is not directed at users under the age of 18. We do not knowingly collect personal data from children. If you believe a child has provided us data, contact our Grievance Officer and we will delete it.</p>
      </section>

      <section id="changes">
        <h2>11. Changes to this policy</h2>
        <p>We may update this Privacy Policy from time to time. Material changes will be notified by email or in-app notice. The "Last updated" date at the top of this page shows when the policy was last revised.</p>
      </section>

      <section id="contact">
        <h2>12. Contact &amp; Grievance Officer</h2>
        <p>For privacy questions, deletion requests, or grievances, contact:</p>
        <p>
          <strong>Grievance Officer, PhotoLancer</strong><br />
          Email: <a href="mailto:privacy@photolancer.in">privacy@photolancer.in</a><br />
          Response window: 30 days.
        </p>
      </section>
    </LegalLayout>
  );
}
