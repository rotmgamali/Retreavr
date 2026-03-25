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
  Building2,
  Users,
  Settings,
  CreditCard,
  ChevronLeft,
  ShieldCheck,
  X,
  ArrowLeft,
  Bot,
  BarChart3,
} from "lucide-react";

const adminNavItems = [
  { label: "Platform Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Tenants", href: "/admin/tenants", icon: Building2 },
  { label: "Voice Agents", href: "/admin/voice-agents", icon: Bot },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Billing", href: "/admin/billing", icon: CreditCard },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

const ADMIN_SIDEBAR_KEY = "retrevr-admin-sidebar-collapsed";

interface SidebarContentProps {
  collapsed: boolean;
  onToggle: () => void;
  onClose?: () => void;
  isMobile?: boolean;
}

function AdminSidebarContent({ collapsed, onToggle, onClose, isMobile }: SidebarContentProps) {
  const rawPathname = usePathname();
  const pathname = rawPathname ?? "/admin";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-indigo-500/20 px-4">
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
              <ShieldCheck className="h-7 w-7 text-indigo-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-indigo-300">Super Admin</span>
                <span className="text-[10px] text-indigo-400/60 leading-tight">Platform Control</span>
              </div>
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
              <ShieldCheck className="h-7 w-7 text-indigo-400" />
            </motion.div>
          )}
        </AnimatePresence>

        {isMobile ? (
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-indigo-500/10 transition-colors text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={onToggle}
            className={cn(
              "rounded-md p-1.5 hover:bg-indigo-500/10 transition-colors text-muted-foreground shrink-0",
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
          {adminNavItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <motion.div key={item.href} variants={sidebarItem}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 overflow-hidden",
                    isActive
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "text-sidebar-foreground hover:bg-indigo-500/10 hover:text-indigo-200"
                  )}
                >
                  {/* Left accent bar */}
                  {isActive && (
                    <motion.div
                      layoutId="admin-active-indicator"
                      className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-indigo-400"
                      style={{ boxShadow: "0 0 8px rgba(129, 140, 248, 0.8)" }}
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}

                  {/* Active border */}
                  {isActive && (
                    <motion.div
                      layoutId="admin-active-border"
                      className="absolute inset-0 rounded-lg border border-indigo-500/30"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}

                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      isActive ? "text-indigo-400" : "text-muted-foreground"
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

      {/* Back to dashboard link */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="p-3"
          >
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Dashboard</span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Desktop sidebar
export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_SIDEBAR_KEY);
    if (stored !== null) setCollapsed(stored === "true");
  }, []);

  const handleToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(ADMIN_SIDEBAR_KEY, String(next));
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 256 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed left-0 top-0 z-40 h-screen border-r border-indigo-500/20 bg-[#0d0f1a] overflow-hidden"
    >
      <AdminSidebarContent collapsed={collapsed} onToggle={handleToggle} />
    </motion.aside>
  );
}

// Mobile drawer
export function AdminMobileDrawer({
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
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            key="drawer"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 z-50 h-screen w-64 border-r border-indigo-500/20 bg-[#0d0f1a]"
          >
            <AdminSidebarContent
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

export function useAdminSidebarState() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_SIDEBAR_KEY);
    if (stored !== null) setCollapsed(stored === "true");

    const handler = () => {
      const val = localStorage.getItem(ADMIN_SIDEBAR_KEY);
      if (val !== null) setCollapsed(val === "true");
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return collapsed;
}
