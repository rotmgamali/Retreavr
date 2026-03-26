"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { TenantOverview } from "@/lib/api-types";
import { useTenantContextStore } from "@/stores/tenant-context-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, ChevronDown, X } from "lucide-react";

export function TenantSwitcher() {
  const { activeTenantId, activeTenantName, setActiveTenant, clearActiveTenant } =
    useTenantContextStore();

  const { data: tenants } = useQuery<{ items: TenantOverview[] }>({
    queryKey: ["admin", "tenants"],
    queryFn: () => api.get<{ items: TenantOverview[] }>("/organizations/"),
    staleTime: 60_000,
  });

  const tenantList = tenants?.items ?? [];

  return (
    <div className="flex items-center gap-1">
      {activeTenantId && (
        <Badge
          variant="outline"
          className="hidden sm:flex items-center gap-1 border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-[10px] px-1.5 py-0.5"
        >
          Viewing tenant
        </Badge>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-sm border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-200"
          >
            <Building2 className="h-4 w-4 text-indigo-400" />
            <span className="hidden sm:inline max-w-[120px] truncate">
              {activeTenantName ?? "All Tenants"}
            </span>
            <ChevronDown className="h-3 w-3 text-indigo-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Switch Org Context
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={clearActiveTenant}
            className="gap-2 text-sm"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Clear (All Tenants)</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {tenantList.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() => setActiveTenant(t.id, t.name)}
              className="gap-2 text-sm"
            >
              <Building2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">{t.name}</span>
              {t.id === activeTenantId && (
                <Badge className="ml-auto h-4 text-[9px] px-1 bg-indigo-500/20 text-indigo-300 border-0">
                  active
                </Badge>
              )}
            </DropdownMenuItem>
          ))}
          {!tenantList.length && (
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              No tenants found
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
