'use client';

import { useState, useEffect } from 'react';
import { SkeletonToContent } from '@/components/animations';
import { SettingsSkeleton } from '@/components/ui/page-skeletons';
import { usePageLoading } from '@/hooks/use-page-loading';
import { useTeamMembers, useAddTeamMember, useUpdateTeamMember, useUpdateIntegration, useIntegrations, useOrganization, useUpdateOrganization } from '@/hooks/use-settings';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { Loader2, AlertTriangle, Link2 } from 'lucide-react';

// ─── Inline state components ─────────────────────────────────────────────────

function LoadingState({ variant: _v, count: _c }: { variant?: string; count?: number }) {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
      <span className="ml-2 text-sm text-slate-400">Loading...</span>
    </div>
  );
}

function ErrorState({ title, onRetry }: { title: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-red-400 mb-2" />
      <p className="text-sm text-slate-300">{title}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-xs text-blue-400 hover:underline">Retry</button>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon?: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && <Icon className="h-8 w-8 text-slate-500 mb-2" />}
      <p className="text-sm font-medium text-slate-300">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{description}</p>
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Integration {
  id: string;
  name: string;
  provider: string;
  connected: boolean;
  lastSynced?: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'invited';
}

const PROVIDER_ICONS: Record<string, string> = {
  salesforce: '☁️',
  hubspot: '🟠',
  twilio: '📞',
  stripe: '💳',
  google: '📅',
  mixpanel: '📊',
  default: '🔗',
};

// ─── Toast helper ─────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
      <span>✓</span>
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-auto text-green-400/60 hover:text-green-400">✕</button>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-xl border border-white/10 bg-white/5 p-6">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function UsageStat({ label, used, total, unit }: { label: string; used: number; total: number; unit: string }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-blue-500';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{used.toLocaleString()}{unit} / {total.toLocaleString()}{unit}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-white/10">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({ label, description, checked, onCheckedChange }: {
  label: string; description?: string; checked: boolean; onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-white/5 last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const loading = usePageLoading(700)
  // ── Integrations (real API) ──
  const integrationsQuery = useIntegrations();
  const updateIntegrationMutation = useUpdateIntegration();

  const integrations: Integration[] = (integrationsQuery.data ?? []).map(i => ({
    id: i.id,
    name: i.name,
    provider: i.provider,
    connected: i.is_active,
    lastSynced: i.created_at ? new Date(i.created_at).toLocaleDateString() : undefined,
  }));

  // ── Team (real API) ──
  const teamQuery = useTeamMembers();
  const addTeamMemberMutation = useAddTeamMember();
  const updateTeamMemberMutation = useUpdateTeamMember();

  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const team: TeamMember[] = (teamQuery.data ?? [])
    .map(m => ({
      id: m.id,
      name: `${m.first_name} ${m.last_name}`.trim() || m.email,
      email: m.email,
      role: m.role,
      status: 'active' as const,
    }))
    .filter(m => !removedIds.includes(m.id));

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('agent');

  // ── Org settings (real API) ──
  const orgQuery = useOrganization();
  const updateOrgMutation = useUpdateOrganization();

  // ── Billing ──
  const [billingEmail, setBillingEmail] = useState('billing@company.com');

  // ── Notifications ──
  const [notifs, setNotifs] = useState({
    email: true, sms: false, digest: true, conversion: true, missedCall: true,
  });
  const [slackWebhook, setSlackWebhook] = useState('');

  // ── Compliance ──
  const [compliance, setCompliance] = useState({
    recording: true, gdpr: false, hipaa: false,
  });
  const [retention, setRetention] = useState(90);

  // ── Branding ──
  const [brand, setBrand] = useState({ company: 'Retrevr Insurance', color: '#3b82f6', logo: '' });

  // ── Sync state from org settings on load ──
  useEffect(() => {
    const s = orgQuery.data?.settings as Record<string, Record<string, unknown>> | undefined;
    if (!s) return;
    if (s.notifications) {
      setNotifs({
        email: (s.notifications.email ?? true) as boolean,
        sms: (s.notifications.sms ?? false) as boolean,
        digest: (s.notifications.digest ?? true) as boolean,
        conversion: (s.notifications.conversion ?? true) as boolean,
        missedCall: (s.notifications.missedCall ?? true) as boolean,
      });
      if (s.notifications.slack_webhook) setSlackWebhook(s.notifications.slack_webhook as string);
    }
    if (s.compliance) {
      setCompliance({
        recording: (s.compliance.recording ?? true) as boolean,
        gdpr: (s.compliance.gdpr ?? false) as boolean,
        hipaa: (s.compliance.hipaa ?? false) as boolean,
      });
      if (s.compliance.retention_days !== undefined) setRetention(s.compliance.retention_days as number);
    }
    if (s.branding) {
      setBrand({
        company: (s.branding.company ?? 'Retrevr Insurance') as string,
        color: (s.branding.color ?? '#3b82f6') as string,
        logo: (s.branding.logo ?? '') as string,
      });
    }
  }, [orgQuery.data]);

  // ── Toasts ──
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ── Settings save helpers ──
  const saveOrgSettings = async (patch: Record<string, unknown>) => {
    const current = (orgQuery.data?.settings ?? {}) as Record<string, unknown>;
    await updateOrgMutation.mutateAsync({ settings: { ...current, ...patch } });
  };

  // ── Handlers ──
  const toggleIntegration = (id: string) => {
    const integration = integrations.find(i => i.id === id);
    const newConnected = !integration?.connected;
    updateIntegrationMutation.mutate({ id, updates: { is_active: newConnected } });
  };

  const sendInvite = async () => {
    if (!inviteEmail) return;
    const namePart = inviteEmail.split('@')[0];
    await addTeamMemberMutation.mutateAsync({
      email: inviteEmail,
      first_name: namePart,
      last_name: '',
      role: inviteRole,
    });
    setInviteEmail('');
    setInviteRole('agent');
    setShowInvite(false);
    showToast('Invitation sent successfully');
  };

  const removeMember = (id: string) => {
    setRemovedIds(prev => [...prev, id]);
  };

  const updateMemberRole = (id: string, role: string) => {
    updateTeamMemberMutation.mutate({ id, updates: { role } });
  };

  return (
    <SkeletonToContent loading={loading} skeleton={<SettingsSkeleton />}>
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your platform configuration</p>
      </div>

      {/* Toast */}
      {toast && (
        <Toast message={toast} onDismiss={() => setToast(null)} />
      )}

      <Tabs defaultValue="integrations">
        <TabsList className="flex h-auto flex-wrap gap-1 p-1">
          {['integrations', 'team', 'billing', 'notifications', 'compliance', 'branding'].map(tab => (
            <TabsTrigger key={tab} value={tab} className="capitalize px-4 py-2">
              {tab === 'team' ? 'Team' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Tab 1: Integrations ─────────────────────────────────────── */}
        <TabsContent value="integrations" className="mt-6 space-y-4">
          <Section title="Connected Integrations" description="Manage third-party service connections">
            {integrationsQuery.isLoading ? (
              <LoadingState variant="skeleton-cards" count={6} />
            ) : integrationsQuery.isError ? (
              <ErrorState title="Failed to load integrations" onRetry={() => integrationsQuery.refetch()} />
            ) : integrations.length === 0 ? (
              <EmptyState icon={Link2} title="No integrations" description="No integrations have been configured yet." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {integrations.map(integration => (
                  <div key={integration.id}
                    className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{PROVIDER_ICONS[integration.provider.toLowerCase()] ?? '🔗'}</span>
                        <div>
                          <p className="text-sm font-semibold">{integration.name}</p>
                          <Badge variant="info" className="mt-0.5 text-[10px] capitalize">{integration.provider}</Badge>
                        </div>
                      </div>
                      <Switch
                        checked={integration.connected}
                        onCheckedChange={() => toggleIntegration(integration.id)}
                      />
                    </div>
                    {integration.connected ? (
                      <p className="text-xs text-muted-foreground">Connected since {integration.lastSynced}</p>
                    ) : (
                      <Button size="sm" variant="outline" className="w-full text-xs"
                        onClick={() => toggleIntegration(integration.id)}>
                        Connect
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </TabsContent>

        {/* ── Tab 2: Team Management ──────────────────────────────────── */}
        <TabsContent value="team" className="mt-6 space-y-4">
          <Section title="Team Members" description="Manage roles and access for your team">
            <div className="mb-4 flex justify-end">
              <Button size="sm" onClick={() => setShowInvite(v => !v)}>
                {showInvite ? 'Cancel' : '+ Invite Member'}
              </Button>
            </div>

            {showInvite && (
              <div className="mb-5 flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Email address</label>
                  <Input placeholder="colleague@company.com" value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)} />
                </div>
                <div className="w-full sm:w-40">
                  <label className="mb-1 block text-xs text-muted-foreground">Role</label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['admin', 'manager', 'agent', 'viewer'].map(r => (
                        <SelectItem key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" onClick={sendInvite}>Send Invite</Button>
              </div>
            )}

            {teamQuery.isLoading ? (
              <LoadingState variant="skeleton-table" count={4} />
            ) : teamQuery.isError ? (
              <ErrorState title="Failed to load team members" onRetry={() => teamQuery.refetch()} />
            ) : team.length === 0 ? (
              <EmptyState icon={Link2} title="No team members" description="Invite your first team member to get started." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs text-muted-foreground">
                      <th className="pb-3 pr-4 font-medium">Name</th>
                      <th className="pb-3 pr-4 font-medium">Email</th>
                      <th className="pb-3 pr-4 font-medium">Role</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map(member => (
                      <tr key={member.id} className="border-b border-white/5 last:border-0">
                        <td className="py-3 pr-4 font-medium">{member.name}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{member.email}</td>
                        <td className="py-3 pr-4">
                          <Select value={member.role} onValueChange={r => updateMemberRole(member.id, r)}>
                            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {['admin', 'manager', 'agent', 'viewer'].map(r => (
                                <SelectItem key={r} value={r} className="capitalize text-xs">
                                  {r.charAt(0).toUpperCase() + r.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={member.status === 'active' ? 'success' : 'warning'}>
                            {member.status}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <Button size="sm" variant="destructive" className="h-7 px-2 text-xs"
                            onClick={() => removeMember(member.id)}>
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </TabsContent>

        {/* ── Tab 3: Billing ──────────────────────────────────────────── */}
        <TabsContent value="billing" className="mt-6 space-y-4">
          {/* Current plan */}
          {(() => {
            const tier = orgQuery.data?.subscription_tier ?? 'pro';
            const PLAN_MAP: Record<string, { name: string; price: number; features: string[] }> = {
              starter: { name: 'Starter', price: 99, features: ['Up to 2 AI agents', '2,000 API calls/mo', '2 GB storage', 'Email support', 'Basic analytics'] },
              pro: { name: 'Growth', price: 299, features: ['Up to 5 AI agents', '10,000 API calls/mo', '10 GB storage', 'Priority support', 'Advanced analytics'] },
              enterprise: { name: 'Enterprise', price: 999, features: ['Unlimited AI agents', 'Unlimited API calls', '100 GB storage', 'Dedicated support', 'Custom integrations'] },
            };
            const plan = PLAN_MAP[tier] ?? PLAN_MAP.pro;
            return (
              <Section title="Current Plan">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold capitalize">{plan.name}</span>
                      <Badge variant="info">Current</Badge>
                    </div>
                    <p className="mt-1 text-3xl font-bold">${plan.price}<span className="text-base font-normal text-muted-foreground">/mo</span></p>
                    <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-center gap-2"><span className="text-green-400">✓</span>{f}</li>
                      ))}
                    </ul>
                  </div>
                  <Button variant="outline" className="shrink-0">Upgrade Plan</Button>
                </div>
              </Section>
            );
          })()}

          {/* Billing email */}
          <Section title="Billing Email">
            <div className="flex gap-3">
              <Input value={billingEmail} onChange={e => setBillingEmail(e.target.value)} className="max-w-sm" />
              <Button size="sm" onClick={() => showToast('Billing email saved')}>Save</Button>
            </div>
          </Section>

          {/* Usage */}
          <Section title="Usage This Month">
            <div className="space-y-4">
              <UsageStat label="API Calls" used={8420} total={10000} unit="" />
              <UsageStat label="Active Agents" used={4} total={5} unit="" />
              <UsageStat label="Storage" used={2.1} total={10} unit=" GB" />
            </div>
          </Section>
        </TabsContent>

        {/* ── Tab 4: Notifications ────────────────────────────────────── */}
        <TabsContent value="notifications" className="mt-6 space-y-4">
          <Section title="Notification Preferences">
            <ToggleRow label="Email notifications" description="Receive summaries and alerts via email"
              checked={notifs.email} onCheckedChange={v => setNotifs(p => ({ ...p, email: v }))} />
            <ToggleRow label="SMS notifications" description="Get urgent alerts via text message"
              checked={notifs.sms} onCheckedChange={v => setNotifs(p => ({ ...p, sms: v }))} />
            <ToggleRow label="Daily digest email" description="A daily summary delivered each morning"
              checked={notifs.digest} onCheckedChange={v => setNotifs(p => ({ ...p, digest: v }))} />
            <ToggleRow label="Notify on conversion" description="Alert when a lead converts to a policy"
              checked={notifs.conversion} onCheckedChange={v => setNotifs(p => ({ ...p, conversion: v }))} />
            <ToggleRow label="Notify on missed call" description="Alert when an agent misses an inbound call"
              checked={notifs.missedCall} onCheckedChange={v => setNotifs(p => ({ ...p, missedCall: v }))} />
            <div className="mt-2 pt-4 border-t border-white/10">
              <Button size="sm" disabled={updateOrgMutation.isPending} onClick={async () => {
                await saveOrgSettings({ notifications: { ...notifs, slack_webhook: slackWebhook } });
                showToast('Notification preferences saved');
              }}>Save Preferences</Button>
            </div>
          </Section>

          <Section title="Slack Webhook" description="Post real-time alerts to a Slack channel">
            <div className="flex gap-3">
              <Input placeholder="https://hooks.slack.com/services/…" value={slackWebhook}
                onChange={e => setSlackWebhook(e.target.value)} className="flex-1" />
              <Button size="sm" variant="outline" onClick={() => showToast('Test message sent to Slack')}>Test</Button>
              <Button size="sm" disabled={updateOrgMutation.isPending} onClick={async () => {
                await saveOrgSettings({ notifications: { ...notifs, slack_webhook: slackWebhook } });
                showToast('Slack webhook saved');
              }}>Save</Button>
            </div>
          </Section>
        </TabsContent>

        {/* ── Tab 5: Compliance ───────────────────────────────────────── */}
        <TabsContent value="compliance" className="mt-6 space-y-4">
          <Section title="Recording & Data">
            <ToggleRow
              label="Call recording enabled"
              description="All calls will be recorded. Ensure disclosure is provided per local regulations."
              checked={compliance.recording}
              onCheckedChange={v => setCompliance(p => ({ ...p, recording: v }))}
            />
            {compliance.recording && (
              <p className="mt-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
                ⚠ You must inform callers that calls are being recorded before the conversation begins.
              </p>
            )}
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium">Data retention period (days)</label>
              <Input type="number" min={30} max={365} value={retention}
                onChange={e => setRetention(Number(e.target.value))} className="w-40" />
              <p className="mt-1 text-xs text-muted-foreground">Between 30 and 365 days</p>
            </div>
          </Section>

          <Section title="Regulatory Compliance">
            <ToggleRow label="GDPR mode" description="Enable consent management and data subject rights tools"
              checked={compliance.gdpr} onCheckedChange={v => setCompliance(p => ({ ...p, gdpr: v }))} />
            <ToggleRow label="HIPAA mode" description="Enable HIPAA-compliant data handling"
              checked={compliance.hipaa} onCheckedChange={v => setCompliance(p => ({ ...p, hipaa: v }))} />
            {compliance.hipaa && (
              <p className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                ⚠ HIPAA mode requires a signed Business Associate Agreement (BAA). Contact support to complete this step.
              </p>
            )}
            <div className="mt-4 pt-4 border-t border-white/10">
              <Button size="sm" disabled={updateOrgMutation.isPending} onClick={async () => {
                await saveOrgSettings({ compliance: { ...compliance, retention_days: retention } });
                showToast('Compliance settings saved');
              }}>Save Settings</Button>
            </div>
          </Section>

          <Section title="Data Management">
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" onClick={() => showToast('Data export initiated — you will receive an email shortly')}>
                Download Data Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => showToast('Audit log opened')}>
                View Audit Log
              </Button>
            </div>
          </Section>
        </TabsContent>

        {/* ── Tab 6: Branding ─────────────────────────────────────────── */}
        <TabsContent value="branding" className="mt-6 space-y-4">
          <Section title="Brand Settings" description="Customize how your platform appears to agents and clients">
            <div className="space-y-5 max-w-lg">
              {/* Company name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Company name</label>
                <Input value={brand.company} onChange={e => setBrand(p => ({ ...p, company: e.target.value }))} />
              </div>

              {/* Primary color */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Primary color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={brand.color}
                    onChange={e => setBrand(p => ({ ...p, color: e.target.value }))}
                    className="h-10 w-14 cursor-pointer rounded-md border border-white/10 bg-transparent p-1" />
                  <Input value={brand.color} onChange={e => setBrand(p => ({ ...p, color: e.target.value }))}
                    className="w-32 font-mono text-xs" maxLength={7} />
                </div>
              </div>

              {/* Logo upload */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Company logo</label>
                <Input type="file" accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) setBrand(p => ({ ...p, logo: URL.createObjectURL(file) }));
                  }}
                  className="cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-xs file:text-foreground" />
              </div>
            </div>
          </Section>

          {/* Preview */}
          <Section title="Preview">
            <div className="rounded-xl border border-white/10 bg-[#0f172a] p-6">
              <div className="flex items-center gap-3 mb-4">
                {brand.logo ? (
                  <img src={brand.logo} alt="logo" className="h-10 w-10 rounded-md object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md text-xl font-bold text-white"
                    style={{ backgroundColor: brand.color }}>
                    {brand.company.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-semibold" style={{ color: brand.color }}>{brand.company || 'Company Name'}</p>
                  <p className="text-xs text-muted-foreground">Insurance Platform</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="rounded-md px-4 py-2 text-sm font-medium text-white transition"
                  style={{ backgroundColor: brand.color }}>
                  Primary Action
                </button>
                <button className="rounded-md border px-4 py-2 text-sm font-medium transition"
                  style={{ borderColor: brand.color, color: brand.color }}>
                  Secondary
                </button>
              </div>
            </div>
          </Section>

          <div>
            <Button disabled={updateOrgMutation.isPending} onClick={async () => {
              await saveOrgSettings({ branding: { company: brand.company, color: brand.color, logo: brand.logo } });
              showToast('Branding settings saved');
            }}>Save Changes</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </SkeletonToContent>
  );
}
