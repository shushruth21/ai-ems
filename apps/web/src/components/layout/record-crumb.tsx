"use client";

import { useEffect } from "react";

import { useShell } from "./shell-context";

/**
 * Names the record a detail page is showing, so the last breadcrumb reads
 * "Aurora Lounge Chair" instead of the row's id. Renders nothing.
 */
export function RecordCrumb({ label }: { label: string }) {
  const { setRecordLabel } = useShell();
  useEffect(() => {
    setRecordLabel(label);
    return () => setRecordLabel(null);
  }, [label, setRecordLabel]);
  return null;
}
