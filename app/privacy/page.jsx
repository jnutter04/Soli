import LegalShell from "@/components/LegalShell";

export const metadata = {
  title: "Privacy Policy · Soli",
  description: "How Soli collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="July 2, 2026">
      <p>
        This Privacy Policy explains how Soli ("Soli", "we", "us") collects, uses, and protects your
        information when you use soli.beauty and the Soli app (the "Service"). By using the Service, you
        agree to this policy.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li><b>Account information:</b> the email address and password you use to sign up. Passwords are stored securely by our authentication provider and are never visible to us.</li>
        <li><b>Business data you enter:</b> the services, prices, times, payment methods, product costs, settings, and any client details (such as names, notes, or phone numbers) you choose to add. This is your data, and you control it.</li>
        <li><b>Payment information:</b> subscription payments are processed by Stripe. We do not see or store your full card number. We store only your subscription status and an identifier that links your account to your Stripe customer record.</li>
        <li><b>Technical information:</b> basic authentication cookies and standard server logs needed to keep you signed in and to operate the Service securely.</li>
      </ul>

      <h2>How we use your information</h2>
      <ul>
        <li>To provide the Service and calculate your take-home, profit, and tax figures.</li>
        <li>To create and secure your account and keep you signed in.</li>
        <li>To manage your free trial and subscription.</li>
        <li>To respond to your support requests.</li>
      </ul>

      <h2>Where your data is stored</h2>
      <p>
        Your data is stored in a database hosted by Supabase and served through Vercel. Access is
        protected by row-level security, so your data is only accessible to your own signed-in account.
      </p>

      <h2>Service providers</h2>
      <p>We share limited information with trusted providers only as needed to run the Service:</p>
      <ul>
        <li><b>Supabase</b> for database and authentication.</li>
        <li><b>Stripe</b> for payment processing.</li>
        <li><b>Vercel</b> for hosting.</li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>Your client information</h2>
      <p>
        If you enter details about your own clients, you are responsible for having the right to store
        that information and for handling it in line with any laws that apply to you.
      </p>

      <h2>Data retention and deletion</h2>
      <p>
        We keep your data while your account is active. You can clear your data at any time from the
        Settings screen, and you can request full deletion of your account by contacting us.
      </p>

      <h2>Children</h2>
      <p>The Service is intended for adults running a business and is not directed to anyone under 18.</p>

      <h2>Changes to this policy</h2>
      <p>We may update this policy from time to time. The date at the top shows when it was last changed.</p>

      <h2>Contact</h2>
      <p>Questions about this policy? Contact us at <a href="mailto:jnutter04@gmail.com">jnutter04@gmail.com</a>.</p>
    </LegalShell>
  );
}
