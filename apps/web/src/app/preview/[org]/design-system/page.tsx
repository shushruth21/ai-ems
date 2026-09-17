import type { Metadata } from "next";

import { PageHeader } from "@ai-ems/ui/components/data/page-header";
import { PageContainer } from "@/components/layout/page-container";
import {
  ButtonsGallery,
  FeedbackGallery,
  OverlaysGallery,
  TabsGallery,
} from "@/features/preview/components/gallery/components-gallery";
import { SampleForm } from "@/features/preview/components/gallery/sample-form";
import { GallerySection } from "@/features/preview/components/gallery/section";
import { TokensGallery } from "@/features/preview/components/gallery/tokens-gallery";

export const metadata: Metadata = { title: "Design system" };

const SECTIONS = [
  ["tokens", "Tokens"],
  ["actions", "Actions & badges"],
  ["overlays", "Overlays"],
  ["forms", "Forms"],
  ["feedback", "Feedback"],
  ["tabs", "Tabs"],
] as const;

export default function DesignSystemPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Design system"
        description="Every AI EMS building block in one place. Switch the theme to check both modes."
      />
      <nav aria-label="On this page" className="flex flex-wrap gap-x-4 gap-y-1 text-base">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="text-muted-foreground hover:text-foreground">
            {label}
          </a>
        ))}
      </nav>
      <GallerySection
        id="tokens"
        title="Tokens"
        description="Semantic colors, chart series and the type scale."
      >
        <TokensGallery />
      </GallerySection>
      <GallerySection id="actions" title="Actions & badges">
        <ButtonsGallery />
      </GallerySection>
      <GallerySection
        id="overlays"
        title="Overlays"
        description="Dialogs, confirmations, drawers, menus, popovers and toasts."
      >
        <OverlaysGallery />
      </GallerySection>
      <GallerySection
        id="forms"
        title="Forms"
        description="React Hook Form + Zod. Errors are linked to fields for screen readers."
      >
        <SampleForm />
      </GallerySection>
      <GallerySection
        id="feedback"
        title="Feedback"
        description="Alerts, stat tiles, loading and empty states."
      >
        <FeedbackGallery />
      </GallerySection>
      <GallerySection id="tabs" title="Tabs">
        <TabsGallery />
      </GallerySection>
    </PageContainer>
  );
}
