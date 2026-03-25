"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Zap, Globe, Shield, Bell } from "lucide-react";

interface FeatureFlag {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  scope: "all" | "enterprise" | "pro";
}

const INITIAL_FLAGS: FeatureFlag[] = [
  { id: "ai-summaries", label: "AI Call Summaries", description: "Auto-generate call summaries using GPT-4o", enabled: true, scope: "all" },
  { id: "sentiment-analysis", label: "Sentiment Analysis", description: "Real-time sentiment scoring during calls", enabled: true, scope: "pro" },
  { id: "multi-agent", label: "Multi-Agent Routing", description: "Route calls to specialist agents by topic", enabled: false, scope: "enterprise" },
  { id: "custom-voices", label: "Custom Voice Cloning", description: "Allow tenants to upload custom voice models", enabled: false, scope: "enterprise" },
  { id: "webhooks", label: "Outbound Webhooks", description: "Push call/lead events to external URLs", enabled: true, scope: "pro" },
  { id: "api-access", label: "API Access", description: "Enable REST API access for tenants", enabled: true, scope: "all" },
  { id: "beta-dashboard", label: "Beta Analytics Dashboard", description: "New analytics dashboard (in beta)", enabled: false, scope: "all" },
];

const scopeColor = (scope: FeatureFlag["scope"]) => {
  if (scope === "enterprise") return "border-indigo-500/40 text-indigo-300";
  if (scope === "pro") return "border-blue-500/40 text-blue-300";
  return "border-emerald-500/40 text-emerald-300";
};

export default function AdminSettingsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>(INITIAL_FLAGS);
  const [maxTenantsLimit, setMaxTenantsLimit] = useState("500");
  const [supportEmail, setSupportEmail] = useState("support@retrevr.ai");
  const [saved, setSaved] = useState(false);

  const toggleFlag = (id: string) => {
    setFlags((prev) => prev.map((f) => f.id === id ? { ...f, enabled: !f.enabled } : f));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-indigo-100">Platform Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Global configuration and feature flags</p>
      </div>

      {/* Feature Flags */}
      <Card className="glass-card border-white/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-400" />
            <CardTitle className="text-base">Feature Flags</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Control feature availability across tenants</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {flags.map((flag, idx) => (
              <div key={flag.id}>
                <div className="flex items-center justify-between py-3 px-1">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{flag.label}</span>
                      <Badge variant="outline" className={`text-[10px] capitalize ${scopeColor(flag.scope)}`}>
                        {flag.scope}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
                  </div>
                  <Switch
                    checked={flag.enabled}
                    onCheckedChange={() => toggleFlag(flag.id)}
                    className="data-[state=checked]:bg-indigo-600"
                  />
                </div>
                {idx < flags.length - 1 && <Separator className="bg-white/5" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Global Config */}
      <Card className="glass-card border-white/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-indigo-400" />
            <CardTitle className="text-base">Global Config</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Max Tenants Limit</label>
              <Input
                type="number"
                value={maxTenantsLimit}
                onChange={(e) => setMaxTenantsLimit(e.target.value)}
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Support Email</label>
              <Input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="bg-white/5 border-white/10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="glass-card border-white/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-indigo-400" />
            <CardTitle className="text-base">Security</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Enforce MFA for all admins", description: "Require multi-factor authentication for all admin-role users", enabled: true },
            { label: "IP allowlist enforcement", description: "Restrict API access to configured IP ranges", enabled: false },
            { label: "Audit log retention (90 days)", description: "Keep platform-wide audit logs for 90 days", enabled: true },
          ].map((item, idx, arr) => (
            <div key={item.label}>
              <div className="flex items-center justify-between py-2 px-1">
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <Switch defaultChecked={item.enabled} className="data-[state=checked]:bg-indigo-600" />
              </div>
              {idx < arr.length - 1 && <Separator className="bg-white/5" />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="glass-card border-white/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-indigo-400" />
            <CardTitle className="text-base">Admin Notifications</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "New tenant signup alerts", enabled: true },
            { label: "Tenant suspension alerts", enabled: true },
            { label: "Platform error alerts", enabled: true },
            { label: "Weekly platform report", enabled: false },
          ].map((item, idx, arr) => (
            <div key={item.label}>
              <div className="flex items-center justify-between py-2 px-1">
                <p className="text-sm">{item.label}</p>
                <Switch defaultChecked={item.enabled} className="data-[state=checked]:bg-indigo-600" />
              </div>
              {idx < arr.length - 1 && <Separator className="bg-white/5" />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
