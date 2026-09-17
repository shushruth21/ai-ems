"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ai-ems/ui/components/ui/breadcrumb";
import { breadcrumbsFor } from "@/config/navigation";

import { useShell } from "./shell-context";

export function AppBreadcrumbs() {
  const { navigation, basePath } = useShell();
  const pathname = usePathname();
  const crumbs = breadcrumbsFor(navigation, pathname, basePath);
  if (!crumbs.length) return null;

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${i}`}>
              <BreadcrumbItem
                className={i < crumbs.length - 2 ? "hidden sm:inline-flex" : undefined}
              >
                {last ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : crumb.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href as Route}>{crumb.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </BreadcrumbItem>
              {last ? null : (
                <BreadcrumbSeparator
                  className={i < crumbs.length - 2 ? "hidden sm:inline-flex" : undefined}
                />
              )}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
