"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const routeLabels: Record<string, string> = {
  "voice-agents": "Voice Agents",
  leads: "Lead Pipeline",
  "call-center": "Call Center",
  campaigns: "Campaigns",
  "call-history": "Call History",
  analytics: "Analytics",
  settings: "Settings",
};

interface BreadcrumbItem {
  label: string;
  href: string;
  current: boolean;
}

function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);

  const crumbs: BreadcrumbItem[] = [
    { label: "Dashboard", href: "/", current: pathname === "/" },
  ];

  if (segments.length === 0) return crumbs;

  let path = "";
  segments.forEach((seg, i) => {
    path += `/${seg}`;
    const label = routeLabels[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
    crumbs.push({
      label,
      href: path,
      current: i === segments.length - 1,
    });
  });

  return crumbs;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildBreadcrumbs(pathname ?? "/");

  // Don't show breadcrumbs on dashboard root (only one item)
  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1 text-sm">
      {crumbs.map((crumb, i) => (
        <React.Fragment key={crumb.href}>
          {i > 0 && (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          )}
          {crumb.current ? (
            <span className="text-foreground font-medium truncate max-w-[160px]">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className={cn(
                "text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1",
                i === 0 && "shrink-0"
              )}
            >
              {i === 0 && <Home className="h-3.5 w-3.5" />}
              <span>{crumb.label}</span>
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
