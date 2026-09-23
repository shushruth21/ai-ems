import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { ContactsManager } from "@/features/crm/components/contacts-manager";
import { requireOrgContext, hasPermission } from "@/server/org/context";
import { accountOptions } from "@ai-ems/db/crm/accounts";
import { listContacts } from "@ai-ems/db/crm/contacts";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage({ params }: PageProps<"/[org]/crm/contacts">) {
  const { org } = await params;
  const ctx = await requireOrgContext(org, "crm.account.read");
  const [contacts, accounts] = await Promise.all([listContacts(ctx.db), accountOptions(ctx.db)]);

  return (
    <PageContainer width="wide">
      <PageHeader title="Contacts" description="People, and which company they belong to." />
      <ContactsManager
        slug={org}
        accounts={accounts}
        canWrite={hasPermission(ctx, "crm.account.write")}
        contacts={contacts.map((contact) => ({
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          jobTitle: contact.jobTitle,
          accountId: contact.accountId,
          accountName: contact.accountName,
          marketingOptIn: contact.marketingOptIn,
        }))}
      />
    </PageContainer>
  );
}
