'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, Search, Clock, User, Bot, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  id: string
  name: string
  phone: string
  status?: string
  insuranceType?: string
}

interface AgentOption {
  id: string
  name: string
  voice: string
  status: 'active' | 'inactive' | 'draft' | 'training'
}

interface RecentCall {
  id: string
  contactName: string
  phone: string
  timestamp: string
  duration: number
}

interface OutboundDialerProps {
  agents: AgentOption[]
  contacts?: Contact[]
  recentCalls?: RecentCall[]
  isLoading?: boolean
  onDial: (phoneNumber: string, agentId: string, leadId?: string) => void
  className?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// ── Component ────────────────────────────────────────────────────────────────

export function OutboundDialer({
  agents,
  contacts = [],
  recentCalls = [],
  isLoading = false,
  onDial,
  className,
}: OutboundDialerProps) {
  const [phoneInput, setPhoneInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    agents.find(a => a.status === 'active')?.id ?? agents[0]?.id ?? ''
  )
  const [showSearch, setShowSearch] = useState(false)

  const activeAgents = useMemo(
    () => agents.filter(a => a.status === 'active'),
    [agents]
  )

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts.slice(0, 5)
    const q = searchQuery.toLowerCase()
    return contacts
      .filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q)
      )
      .slice(0, 8)
  }, [contacts, searchQuery])

  const phoneDigits = phoneInput.replace(/\D/g, '')
  const canDial = phoneDigits.length >= 10 && selectedAgentId

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value)
    setPhoneInput(formatted)
  }, [])

  const handleDial = useCallback(() => {
    if (!canDial) return
    onDial(phoneDigits, selectedAgentId)
  }, [canDial, phoneDigits, selectedAgentId, onDial])

  const handleContactSelect = useCallback((contact: Contact) => {
    setPhoneInput(formatPhoneInput(contact.phone))
    setSearchQuery('')
    setShowSearch(false)
  }, [])

  const handleQuickDial = useCallback((phone: string) => {
    setPhoneInput(formatPhoneInput(phone))
  }, [])

  return (
    <Card className={cn('glass-card', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Phone className="h-4 w-4 text-blue-400" />
          Outbound Dialer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phone input */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground font-medium">Phone Number</label>
          <div className="relative">
            <Input
              placeholder="(555) 123-4567"
              value={phoneInput}
              onChange={handlePhoneChange}
              maxLength={14}
              className="font-mono text-lg h-12 pr-10"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canDial) handleDial()
              }}
            />
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-white/10 transition-colors"
              onClick={() => setShowSearch(!showSearch)}
            >
              <Search className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Contact search */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-2">
                <Input
                  placeholder="Search contacts or leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
                <ScrollArea className="max-h-[160px]">
                  <div className="space-y-1">
                    {filteredContacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => handleContactSelect(contact)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="h-7 w-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                          <User className="h-3.5 w-3.5 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{contact.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{contact.phone}</p>
                        </div>
                        {contact.status && (
                          <Badge variant="secondary" className="text-[9px] shrink-0">
                            {contact.status}
                          </Badge>
                        )}
                      </button>
                    ))}
                    {filteredContacts.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No contacts found
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Agent selection */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground font-medium">Voice Agent</label>
          <div className="grid grid-cols-2 gap-2">
            {activeAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all text-sm',
                  selectedAgentId === agent.id
                    ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/5 text-muted-foreground'
                )}
              >
                <Bot className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{agent.name}</span>
              </button>
            ))}
          </div>
          {activeAgents.length === 0 && (
            <p className="text-xs text-muted-foreground">No active agents available</p>
          )}
        </div>

        {/* Dial button */}
        <motion.div whileTap={canDial ? { scale: 0.98 } : undefined}>
          <Button
            onClick={handleDial}
            disabled={!canDial || isLoading}
            className="w-full h-12 bg-green-600 hover:bg-green-500 text-white rounded-xl text-base font-semibold gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Phone className="h-5 w-5" />
                Call
              </>
            )}
          </Button>
        </motion.div>

        {/* Recent calls */}
        {recentCalls.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Recent Calls</span>
            </div>
            <div className="space-y-1">
              {recentCalls.slice(0, 4).map((call) => (
                <button
                  key={call.id}
                  onClick={() => handleQuickDial(call.phone)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{call.contactName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground">
                    <span className="font-mono">{formatDuration(call.duration)}</span>
                    <span>{getTimeAgo(call.timestamp)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
