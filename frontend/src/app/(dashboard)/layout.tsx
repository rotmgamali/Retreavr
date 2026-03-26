"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar, MobileDrawer } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { PageTransition } from "@/components/layout/page-transition";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { VoiceCallWidget } from "@/components/voice/voice-call-widget";
import { useAuth } from "@/providers/auth-provider";
import { api } from "@/lib/api-client";

const SIDEBAR_KEY = "retrevr-sidebar-collapsed";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Track whether we are on a desktop viewport
  const [isDesktop, setIsDesktop] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_onboardingChecked, setOnboardingChecked] = useState(false);

  // Check onboarding status and redirect if not completed
  // Superadmins skip onboarding entirely
  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) return;

    // Superadmins never go through onboarding
    if (user.role === "superadmin") {
      setOnboardingChecked(true);
      return;
    }

    let cancelled = false;
    api
      .get<{ onboarding_completed: boolean }>("/onboarding/status")
      .then((status) => {
        if (!cancelled && !status.onboarding_completed) {
          router.push("/onboarding");
        } else if (!cancelled) {
          setOnboardingChecked(true);
        }
      })
      .catch(() => {
        // If the status check fails, allow dashboard access
        if (!cancelled) setOnboardingChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, user, router]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const read = () => {
      const stored = localStorage.getItem(SIDEBAR_KEY);
      setSidebarCollapsed(stored === "true");
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const marginLeft = isDesktop ? (sidebarCollapsed ? 64 : 256) : 0;

  return (
    <ProtectedRoute>
      <div className="min-h-screen">
        {/* Desktop sidebar — persistent only on lg+ (≥1024px); tablets use mobile drawer */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Mobile drawer */}
        <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

        {/* Content area */}
        <motion.div
          className="flex flex-col min-h-screen"
          animate={{ marginLeft }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <Header onMenuOpen={() => setMobileOpen(true)} />
          <main className="p-4 md:p-6 flex-1">
            <AnimatePresence mode="wait">
              <PageTransition key={pathname}>{children}</PageTransition>
            </AnimatePresence>
          </main>
        </motion.div>

        {/* Floating voice call widget — available on every dashboard page */}
        <VoiceCallWidget />
      </div>
    </ProtectedRoute>
  );
}
