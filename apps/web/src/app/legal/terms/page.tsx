import type { Metadata } from "next";

import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms govern use of this AI EMS deployment. The operator of this deployment must
        replace this placeholder with its own terms, reviewed by counsel, before going live.
      </p>
    </LegalPage>
  );
}
