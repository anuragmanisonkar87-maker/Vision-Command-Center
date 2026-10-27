import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — PhotoLancer" },
      { name: "description", content: "PhotoLancer Terms of Service for clients, photographers, studios, and second shooters in India." },
      { property: "og:title", content: "Terms of Service — PhotoLancer" },
      { property: "og:description", content: "Read the terms that govern bookings, escrow payments, and listings on PhotoLancer." },
    ],
  }),
  component: TermsPage,
});

const sections = [
  { id: "acceptance", label: "1. Acceptance of terms" },
  { id: "accounts", label: "2. Accounts and roles" },
  { id: "acceptable-use", label: "3. Acceptable use" },
  { id: "listings", label: "4. Listings and content" },
  { id: "bookings", label: "5. Bookings and escrow" },
  { id: "commission", label: "6. Commission and featured listings" },
  { id: "contractor", label: "7. Independent contractor relationship" },
  { id: "ip", label: "8. Intellectual property and portfolio" },
  { id: "liability", label: "9. Disclaimers and liability" },
  { id: "termination", label: "10. Termination" },
  { id: "law", label: "11. Governing law" },
  { id: "contact", label: "12. Contact" },
];

function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      intro="These Terms govern your access to and use of PhotoLancer, a two-sided marketplace operated in India that connects clients with photographers, studios, and second shooters."
      lastUpdated="15 June 2026"
      sections={sections}
    >
      <section id="acceptance">
        <h2>1. Acceptance of terms</h2>
        <p>By creating an account, listing services, booking a photographer, or otherwise using PhotoLancer (the "Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Platform.</p>
        <p>PhotoLancer is operated from India and provides marketplace, escrow, and discovery services. It is not the photographer; it does not perform photography services itself.</p>
      </section>

      <section id="accounts">
        <h2>2. Accounts and roles</h2>
        <p>You may register on PhotoLancer in one or more of the following roles:</p>
        <ul>
          <li><strong>Client</strong> — an individual or business booking a photographer for an event, project, or shoot.</li>
          <li><strong>Photographer</strong> — an individual professional offering photography services.</li>
          <li><strong>Studio</strong> — a business that lists services and may hire freelance second shooters via the Platform.</li>
          <li><strong>Second shooter</strong> — a freelance photographer who accepts B2B gigs from studios.</li>
        </ul>
        <p>You must be at least 18 years old and able to enter into a binding contract under Indian law. You are responsible for the accuracy of your profile, the confidentiality of your credentials, and all activity that occurs under your account.</p>
      </section>

      <section id="acceptable-use">
        <h2>3. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Platform for any unlawful, fraudulent, or misleading purpose;</li>
          <li>Post content that is defamatory, obscene, infringing, or violates another person's privacy or dignity;</li>
          <li>Circumvent the booking, payment, or messaging features to avoid commission or escrow;</li>
          <li>Harvest data, scrape listings, or interfere with the operation of the Platform;</li>
          <li>Misrepresent your identity, qualifications, or portfolio.</li>
        </ul>
        <p>We may suspend or remove any account that breaches this section.</p>
      </section>

      <section id="listings">
        <h2>4. Listings and content</h2>
        <p>Photographers and studios are solely responsible for their listings, including pricing, availability, descriptions, packages, and sample work. You warrant that all sample images you upload are your own work or that you have the right to display them.</p>
        <p>You grant PhotoLancer a non-exclusive, royalty-free, worldwide licence to host, display, and promote your listing content on the Platform and in related marketing while your account is active.</p>
      </section>

      <section id="bookings">
        <h2>5. Bookings and escrow</h2>
        <p>When a client confirms a booking, the booking amount is charged via our payment gateway partner and held in <strong>escrow</strong> by PhotoLancer. Funds are not released to the photographer or studio until after the event takes place and the release window described in our <a href="/refund-policy">Cancellation &amp; Refund Policy</a> has elapsed.</p>
        <p>The Platform is the contracting venue but the photography services themselves are provided by the photographer or studio directly to the client. Specific deliverables, timelines, and add-ons should be confirmed in writing between the parties.</p>
      </section>

      <section id="commission">
        <h2>6. Commission and featured listings</h2>
        <p>PhotoLancer charges a <strong>platform commission</strong> on every completed booking. The commission rate is shown to photographers and studios before they accept a booking and is deducted from the escrow release.</p>
        <p>Photographers and studios may purchase optional <strong>Featured listing</strong> placements that increase visibility in search and category pages. Featured placements are billed separately from commission, are non-refundable once active, and do not guarantee bookings.</p>
      </section>

      <section id="contractor">
        <h2>7. Independent contractor relationship</h2>
        <p>For B2B gigs between studios and second shooters, the second shooter engages with the studio strictly as an <strong>independent contractor</strong>. Nothing on PhotoLancer creates an employer-employee relationship, partnership, joint venture, or agency between you and PhotoLancer, or between studios and second shooters.</p>
        <p>Each party is responsible for its own taxes, equipment, insurance, and statutory compliance, including GST registration and TDS where applicable.</p>
      </section>

      <section id="ip">
        <h2>8. Intellectual property and portfolio</h2>
        <p>Copyright in photographs taken during a booking vests in the photographer by default under the Indian Copyright Act, 1957, subject to any written agreement between the photographer and the client.</p>
        <p>Unless agreed otherwise in writing, the photographer may display images delivered under a booking in their PhotoLancer portfolio and other professional channels. Clients who require exclusivity must request and pay for a buy-out in writing.</p>
        <p>PhotoLancer's trademarks, logo, software, and platform design remain the exclusive property of PhotoLancer.</p>
      </section>

      <section id="liability">
        <h2>9. Disclaimers and liability</h2>
        <p>The Platform is provided on an "as is" and "as available" basis. PhotoLancer does not guarantee the quality, safety, or legality of services offered by photographers or studios, nor the conduct of any user.</p>
        <p>To the maximum extent permitted by law, PhotoLancer's total aggregate liability arising out of or in connection with these Terms shall not exceed the commission actually received by PhotoLancer from the booking that gave rise to the claim. PhotoLancer is not liable for indirect, incidental, or consequential damages.</p>
      </section>

      <section id="termination">
        <h2>10. Termination</h2>
        <p>You may close your account at any time from your account settings, subject to settlement of any active bookings. We may suspend or terminate accounts that breach these Terms, with or without notice where required by law.</p>
      </section>

      <section id="law">
        <h2>11. Governing law and dispute resolution</h2>
        <p>These Terms are governed by the laws of India. Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts at <strong>Bengaluru, Karnataka</strong>, and shall, at PhotoLancer's election, be referred to arbitration under the Arbitration and Conciliation Act, 1996.</p>
      </section>

      <section id="contact">
        <h2>12. Contact</h2>
        <p>For questions about these Terms, write to us at <a href="mailto:legal@photolancer.in">legal@photolancer.in</a>.</p>
      </section>
    </LegalLayout>
  );
}
