"use client";

import React from "react";
import { Menu, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface AdminHeaderProps {
  onMenuOpen?: () => void;
}

export function AdminHeader({ onMenuOpen }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-indigo-500/20 bg-[#080a12]/80 backdrop-blur-xl px-4 md:px-6">
      {/* Mobile menu trigger */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuOpen}
        className="lg:hidden shrink-0 text-muted-foreground"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Left: badge */}
      <div className="flex items-center gap-2 flex-1">
        <ShieldCheck className="h-5 w-5 text-indigo-400 hidden lg:block" />
        <Badge
          variant="outline"
          className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 hidden lg:inline-flex"
        >
          Super Admin Panel
        </Badge>
      </div>

      {/* Right: back link */}
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-indigo-300 transition-colors"
      >
        ← Back to Dashboard
      </Link>
    </header>
  );
}
