import "server-only";

import { headers } from "next/headers";

import { env } from "@ai-ems/config/env.server";

export interface RequestMeta {
  ip: string;
  userAgent: string | null;
}

/** First hop of a proxy header, validated loosely (IPv4/IPv6 characters only). */
export function parseClientIp(value: string | null | undefined): string | null {
  const first = value?.split(",")[0]?.trim();
  if (!first || first.length > 45 || !/^[0-9a-fA-F:.]+$/.test(first)) return null;
  return first;
}

export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const ip = parseClientIp(h.get(env().TRUSTED_IP_HEADER)) ?? "unknown";
  return { ip, userAgent: h.get("user-agent") };
}
