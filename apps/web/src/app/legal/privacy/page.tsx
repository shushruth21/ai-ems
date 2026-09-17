import type { Metadata } from "next";

import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This deployment stores account details (name, email), security events (sign-ins, IP address,
        browser) and the business records you create. See docs/governance for classification and
        retention. The operator must replace this placeholder with its own policy before going live.
      </p>
    </LegalPage>
  );
}
