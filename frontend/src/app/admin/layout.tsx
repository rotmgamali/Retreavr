"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AdminSidebar, AdminMobileDrawer } from "@/components/admin/admin-sidebar";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PageTransition } from "@/components/layout/page-transition";
import { AdminHeader } from "@/components/admin/admin-header";
import { ErrorBoundary } from "@/components/error-boundary";

const ADMIN_SIDEBAR_KEY = "retrevr-admin-sidebar-collapsed";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const read = () => {
      const stored = localStorage.getItem(ADMIN_SIDEBAR_KEY);
      setSidebarCollapsed(stored === "true");
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const marginLeft = isDesktop ? (sidebarCollapsed ? 64 : 256) : 0;

  return (
    <ProtectedRoute requiredRoles={["superadmin"]}>
      <div className="min-h-screen bg-[#080a12]">
        <div className="hidden lg:block">
          <AdminSidebar />
        </div>

        <AdminMobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

        <motion.div
          className="flex flex-col min-h-screen"
          animate={{ marginLeft }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <AdminHeader onMenuOpen={() => setMobileOpen(true)} />
          <main className="p-4 md:p-6 flex-1">
            <ErrorBoundary>
              <AnimatePresence mode="wait">
                <PageTransition key={pathname}>{children}</PageTransition>
              </AnimatePresence>
            </ErrorBoundary>
          </main>
        </motion.div>
      </div>
    </ProtectedRoute>
  );
}
