"use client";

import React, { useState } from "react";
import { Bell, Search, User, Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "./breadcrumbs";

interface HeaderProps {
  onMenuOpen?: () => void;
}

export function Header({ onMenuOpen }: HeaderProps) {
  const [bellRing, setBellRing] = useState(false);

  const handleBellClick = () => {
    setBellRing(true);
    setTimeout(() => setBellRing(false), 600);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-white/10 bg-background/80 backdrop-blur-xl px-4 md:px-6">
      {/* Mobile/tablet menu trigger — visible below lg (1024px) */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuOpen}
        className="lg:hidden shrink-0 text-muted-foreground"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Breadcrumbs (hidden on mobile/tablet) */}
      <div className="hidden lg:flex items-center flex-1 min-w-0">
        <Breadcrumbs />
      </div>

      {/* Search */}
      <div className="flex items-center flex-1 max-w-xs md:max-w-md ml-auto lg:ml-0">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search leads, calls, agents..."
            className="pl-9 bg-white/5 border-white/10"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Bell with bounce + badge pop-in */}
        <motion.button
          onClick={handleBellClick}
          whileTap={{ scale: 0.9 }}
          className="relative inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-white/10 transition-colors"
          aria-label="Notifications"
        >
          <motion.span
            animate={bellRing ? { rotate: [0, -18, 18, -12, 12, -6, 6, 0] } : {}}
            transition={{ duration: 0.55, ease: "easeInOut" }}
            className="inline-flex"
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
          </motion.span>
          <AnimatePresence>
            <motion.div
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="absolute -top-1 -right-1"
            >
              <Badge
                variant="destructive"
                className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]"
              >
                3
              </Badge>
            </motion.div>
          </AnimatePresence>
        </motion.button>

        <div className="flex items-center gap-3 pl-3 border-l border-white/10">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">Admin User</p>
            <p className="text-xs text-muted-foreground">Agency Admin</p>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full">
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
