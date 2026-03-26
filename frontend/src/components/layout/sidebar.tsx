"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { sidebarContainer, sidebarItem } from "@/lib/motion";
import {
  LayoutDashboard,
  Bot,
  Users,
  Phone,
  Megaphone,
  History,
  BarChart3,
  Settings,
  ChevronLeft,
  Shield,
  X,
  Calculator,
  BookOpen,
  Headphones,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Voice Agents", href: "/voice-agents", icon: Bot },
  { label: "Lead Pipeline", href: "/leads", icon: Users },
  { label: "Quotes", href: "/quotes", icon: Calculator },
  { label: "Call Center", href: "/call-center", icon: Phone },
  { label: "Supervision", href: "/supervision", icon: Headphones },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Call History", href: "/call-history", icon: History },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Knowledge Base", href: "/knowledge", icon: BookOpen },
  { label: "Settings", href: "/settings", icon: Settings },
];

const SIDEBAR_KEY = "retrevr-sidebar-collapsed";

interface SidebarContentProps {
  collapsed: boolean;
  onToggle: () => void;
  onClose?: () => void;
  isMobile?: boolean;
}

function SidebarContent({ collapsed, onToggle, onClose, isMobile }: SidebarContentProps) {
  const rawPathname = usePathname();
  const pathname = rawPathname ?? "/";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
        <AnimatePresence mode="wait">
          {!collapsed ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2"
            >
              <Link href="/" className="flex items-center gap-2">
                <Shield className="h-8 w-8 text-blue-500 shrink-0" />
                <span className="text-lg font-bold gradient-text">Retrevr</span>
              </Link>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="mx-auto"
            >
              <Link href="/">
                <Shield className="h-8 w-8 text-blue-500" />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {isMobile ? (
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-white/10 transition-colors text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={onToggle}
            className={cn(
              "rounded-md p-1.5 hover:bg-white/10 transition-colors text-muted-foreground shrink-0",
              collapsed && "mx-auto"
            )}
          >
            <motion.div
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronLeft className="h-4 w-4" />
            </motion.div>
          </button>
        )}
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1">
      <motion.nav
        className="flex flex-col gap-1 p-3"
        variants={sidebarContainer}
        initial="hidden"
        animate="visible"
      >
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : (pathname ?? "").startsWith(item.href);
          return (
            <motion.div key={item.href} variants={sidebarItem}>
            <Link
              href={item.href}
              onClick={onClose}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 overflow-hidden",
                isActive
                  ? "bg-blue-500/20 text-blue-400"
                  : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground"
              )}
            >
              {/* Left accent bar */}
              {isActive && (
                <motion.div
                  layoutId="active-indicator"
                  className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-blue-400"
                  style={{
                    boxShadow: "0 0 8px rgba(96, 165, 250, 0.8)",
                  }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}

              {/* Active border */}
              {isActive && (
                <motion.div
                  layoutId="active-border"
                  className="absolute inset-0 rounded-lg border border-blue-500/30"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}

              <item.icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  isActive && "text-blue-400"
                )}
              />
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.span
                    key="label"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
            </motion.div>
          );
        })}
      </motion.nav>
      </ScrollArea>

      {/* Footer */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="p-3"
          >
            <div className="glass-card rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Insurance Platform</p>
              <p className="text-xs font-medium text-blue-400">v1.0.0 MVP</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Desktop sidebar
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored !== null) {
      setCollapsed(stored === "true");
    }
  }, []);

  const handleToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(SIDEBAR_KEY, String(next));
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 256 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed left-0 top-0 z-40 h-screen border-r border-white/10 bg-sidebar overflow-hidden"
    >
      <SidebarContent collapsed={collapsed} onToggle={handleToggle} />
    </motion.aside>
  );
}

// Mobile drawer
export function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          {/* Drawer panel */}
          <motion.aside
            key="drawer"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 z-50 h-screen w-64 border-r border-white/10 bg-sidebar"
          >
            <SidebarContent
              collapsed={false}
              onToggle={() => {}}
              onClose={onClose}
              isMobile
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// Hook to expose sidebar collapsed state for layout responsiveness
export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored !== null) setCollapsed(stored === "true");

    const handler = () => {
      const val = localStorage.getItem(SIDEBAR_KEY);
      if (val !== null) setCollapsed(val === "true");
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return collapsed;
}
