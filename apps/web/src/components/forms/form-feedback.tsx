import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@ai-ems/ui/components/ui/alert";

import type { FormFeedback as Feedback } from "@/lib/use-action-form";

export function FormFeedback({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null;
  return (
    <Alert tone={feedback.tone}>
      {feedback.tone === "danger" ? (
        <CircleAlert />
      ) : feedback.tone === "warning" ? (
        <TriangleAlert />
      ) : (
        <CircleCheck />
      )}
      <AlertDescription>{feedback.message}</AlertDescription>
    </Alert>
  );
}
