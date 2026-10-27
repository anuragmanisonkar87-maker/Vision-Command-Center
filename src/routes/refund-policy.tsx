import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Cancellation & Refund Policy — PhotoLancer" },
      { name: "description", content: "How cancellations, refunds, escrow release, and disputes work on PhotoLancer." },
      { property: "og:title", content: "Cancellation & Refund Policy — PhotoLancer" },
      { property: "og:description", content: "Read how cancellations, refunds, and escrow release are handled on PhotoLancer." },
    ],
  }),
  component: RefundPage,
});

const sections = [
  { id: "overview", label: "1. Overview" },
  { id: "how-payments-work", label: "2. How payments work" },
  { id: "cancellation-client", label: "3. Cancellation by the client" },
  { id: "cancellation-photographer", label: "4. Cancellation by the photographer" },
  { id: "no-show", label: "5. No-show or non-performance" },
  { id: "refunds", label: "6. Refund eligibility and timelines" },
  { id: "escrow-release", label: "7. Escrow release schedule" },
  { id: "disputes", label: "8. Dispute handling" },
  { id: "featured", label: "9. Featured listings (non-refundable)" },
  { id: "force-majeure", label: "10. Force majeure" },
  { id: "contact", label: "11. Contact" },
];

function RefundPage() {
  return (
    <LegalLayout
      title="Cancellation & Refund Policy"
      intro="This policy explains how cancellations, refunds, and the escrow release schedule work on PhotoLancer. It applies to every booking made through the Platform."
      lastUpdated="15 June 2026"
      sections={sections}
    >
      <section id="overview">
        <h2>1. Overview</h2>
        <p>PhotoLancer holds booking payments in escrow until after the event and releases funds to the photographer or studio in accordance with this policy. Refunds, where applicable, are processed back to the original payment method.</p>
      </section>

      <section id="how-payments-work">
        <h2>2. How payments work</h2>
        <ol>
          <li>The client pays the full booking amount upfront via our payment gateway.</li>
          <li>PhotoLancer holds the funds in escrow.</li>
          <li>The photographer or studio performs the shoot on the scheduled date.</li>
          <li>After the release window, PhotoLancer deducts its commission and pays the balance to the photographer or studio.</li>
        </ol>
      </section>

      <section id="cancellation-client">
        <h2>3. Cancellation by the client</h2>
        <p>Clients may cancel a booking from their dashboard. The refund depends on when the cancellation is made, measured from the scheduled shoot date:</p>
        <ul>
          <li><strong>More than 14 days before</strong> — full refund (100% of the booking amount).</li>
          <li><strong>7 to 14 days before</strong> — partial refund of 50%.</li>
          <li><strong>Less than 7 days before</strong> — no refund (0%); the photographer has typically blocked the date.</li>
        </ul>
        <p>Payment gateway charges, if any, may be deducted from the refundable amount.</p>
      </section>

      <section id="cancellation-photographer">
        <h2>4. Cancellation by the photographer</h2>
        <p>If a photographer or studio cancels a confirmed booking, the client is entitled to a <strong>full refund</strong> of the booking amount, and PhotoLancer may apply penalties or temporary suspension to the cancelling account.</p>
      </section>

      <section id="no-show">
        <h2>5. No-show or non-performance</h2>
        <p>If the photographer fails to show up or does not perform the agreed shoot, the client must report it within <strong>48 hours</strong> with supporting evidence (photos, messages, witnesses). On verification, the booking will be refunded in full and the photographer's payout cancelled.</p>
      </section>

      <section id="refunds">
        <h2>6. Refund eligibility and timelines</h2>
        <p>Approved refunds are initiated within <strong>3 working days</strong> of approval. Funds typically reach your account within <strong>5–10 working days</strong>, depending on your bank and payment method. The refund will be made to the original payment method only.</p>
      </section>

      <section id="escrow-release">
        <h2>7. Escrow release schedule</h2>
        <p>For each completed shoot, the escrow release works as follows:</p>
        <ul>
          <li><strong>T = shoot date.</strong></li>
          <li><strong>T + 48 hours</strong> — automatic dispute window opens; the client may raise a dispute.</li>
          <li><strong>T + 7 days</strong> — if no dispute is raised, PhotoLancer deducts its commission and initiates payout to the photographer or studio.</li>
          <li><strong>Payout settlement</strong> — funds typically reach the photographer's bank account within 2–5 working days of release, depending on the payment gateway.</li>
        </ul>
        <p>If a dispute is raised, escrow release is paused until the dispute is resolved (see section 8).</p>
      </section>

      <section id="disputes">
        <h2>8. Dispute handling</h2>
        <p>Either party may raise a dispute through the Platform within the dispute window. PhotoLancer will:</p>
        <ol>
          <li>Notify the other party and collect statements from both sides;</li>
          <li>Review evidence (messages, contracts, sample deliveries);</li>
          <li>Decide one of: full refund, partial refund, or release to the photographer;</li>
          <li>Communicate the decision within <strong>10 working days</strong>.</li>
        </ol>
        <p>PhotoLancer's decision is final for the purposes of escrow release but does not affect either party's legal rights.</p>
      </section>

      <section id="featured">
        <h2>9. Featured listings (non-refundable)</h2>
        <p>Featured listing fees paid by photographers or studios are <strong>non-refundable</strong> once the placement is live, except where the placement could not be delivered due to a failure on our side.</p>
      </section>

      <section id="force-majeure">
        <h2>10. Force majeure</h2>
        <p>If a shoot cannot take place due to events beyond either party's reasonable control (such as natural disasters, government-imposed restrictions, or serious illness), the parties will work in good faith to reschedule. If rescheduling is not possible, PhotoLancer may approve a refund or partial refund on a case-by-case basis.</p>
      </section>

      <section id="contact">
        <h2>11. Contact</h2>
        <p>For cancellations, refunds, or disputes, contact <a href="mailto:support@photolancer.in">support@photolancer.in</a> or use the in-app help centre.</p>
      </section>
    </LegalLayout>
  );
}
