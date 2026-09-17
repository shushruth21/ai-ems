import { CircleAlert, CircleCheck } from "lucide-react";

import { Alert, AlertDescription } from "@ai-ems/ui/components/ui/alert";

import type { FormFeedback as Feedback } from "../use-action-form";

export function FormFeedback({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null;
  return (
    <Alert tone={feedback.tone}>
      {feedback.tone === "danger" ? <CircleAlert /> : <CircleCheck />}
      <AlertDescription>{feedback.message}</AlertDescription>
    </Alert>
  );
}
