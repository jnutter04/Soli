import LegalShell from "@/components/LegalShell";

export const metadata = {
  title: "Terms of Service · Soli",
  description: "The terms that govern your use of Soli.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="July 2, 2026">
      <p>
        These Terms of Service ("Terms") govern your use of soli.beauty and the Soli app (the "Service"),
        operated by Soli ("we", "us"). By creating an account or using the Service, you agree to these Terms.
      </p>

      <h2>The Service</h2>
      <p>
        Soli helps beauty professionals track income, costs, and estimated take-home, profit, and taxes.
        The figures Soli shows are estimates based on the numbers you enter.
      </p>

      <div className="legal-note">
        <b>Not financial or tax advice.</b> Soli is an informational tool, not a substitute for a
        professional. It does not provide financial, tax, accounting, or legal advice. You are responsible
        for your own pricing, bookkeeping, and tax filings, and you should consult a qualified professional
        for advice specific to your situation.
      </div>

      <h2>Your account</h2>
      <p>
        You are responsible for keeping your login details secure and for all activity that happens under
        your account. Let us know right away if you suspect unauthorized use.
      </p>

      <h2>Free trial, subscriptions, and billing</h2>
      <ul>
        <li>New accounts include a <b>14-day free trial</b> with full access.</li>
        <li>After the trial, continued access requires a <b>Soli Pro</b> subscription at <b>$12 per month</b>, billed through Stripe.</li>
        <li>Subscriptions renew automatically each month until canceled.</li>
        <li>You can cancel anytime from the billing portal ("Manage billing"). Your access continues until the end of the current paid period.</li>
        <li>Prices may change in the future; we will give notice of any change before it applies to you.</li>
      </ul>

      <h2>Refunds</h2>
      <p>
        Except where required by law, payments are non-refundable. You can cancel at any time to prevent
        future charges.
      </p>

      <h2>Acceptable use</h2>
      <p>
        You agree not to misuse the Service, attempt to break its security, access other users' data, or
        use it for any unlawful purpose.
      </p>

      <h2>Your data</h2>
      <p>
        You own the data you enter. You grant us permission to store and process it solely to provide the
        Service to you. See our <a href="/privacy">Privacy Policy</a> for details.
      </p>

      <h2>Availability and disclaimer</h2>
      <p>
        The Service is provided "as is" and "as available", without warranties of any kind. We do not
        guarantee that it will be uninterrupted, error-free, or that the figures shown will be accurate for
        your specific circumstances.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Soli will not be liable for any indirect, incidental, or
        consequential damages, or for any decisions you make based on the Service. Our total liability to
        you will not exceed the amount you paid us in the 12 months before the claim.
      </p>

      <h2>Termination</h2>
      <p>
        We may suspend or end access for violations of these Terms. You may stop using the Service at any time.
      </p>

      <h2>Changes to these Terms</h2>
      <p>We may update these Terms from time to time. The date at the top shows when they were last changed.</p>

      <h2>Governing law</h2>
      <p>
        These Terms are governed by the laws of the State of Ohio, United States, without regard to its
        conflict-of-law rules.
      </p>

      <h2>Contact</h2>
      <p>Questions about these Terms? Contact us at <a href="mailto:jnutter04@gmail.com">jnutter04@gmail.com</a>.</p>
    </LegalShell>
  );
}
