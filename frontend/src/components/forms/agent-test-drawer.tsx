"use client"

import React, { useEffect, useRef } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Mic, PhoneOff, User, Bot, AlertCircle } from "lucide-react"
import { useRealtimeVoice } from "@/hooks/use-realtime-voice"
import { Waveform } from "@/components/visualizations/waveform"

interface AgentTestDrawerProps {
  agent: { id: string; name: string }
  onOpenChange: (open: boolean) => void
}

export function AgentTestDrawer({ agent, onOpenChange }: AgentTestDrawerProps) {
  const { 
    start, 
    stop, 
    isConnected, 
    transcript, 
    error, 
    audioInputLevel 
  } = useRealtimeVoice(agent.id)

  const transcriptEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  return (
    <Drawer open={true} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[80vh] bg-slate-950 border-slate-800">
        <DrawerHeader className="border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="text-white flex items-center gap-2 text-2xl">
                Testing {agent.name}
                <Badge variant={isConnected ? "outline" : "secondary"} className={isConnected ? "border-green-500/50 text-green-400" : "bg-slate-800 text-slate-400"}>
                  {isConnected ? "LIVE" : "IDLE"}
                </Badge>
              </DrawerTitle>
              <DrawerDescription className="text-slate-400">
                Live conversation preview with OpenAI Realtime API
              </DrawerDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Latency</p>
                <p className="text-sm font-mono text-slate-300">~120ms</p>
              </div>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-hidden flex flex-col p-6 gap-6">
          <div className="flex-1 bg-black/40 rounded-2xl border border-slate-800/50 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6">
                {transcript.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-4">
                    <div className="p-4 bg-slate-900 rounded-full">
                      <Mic className="w-8 h-8 opacity-20" />
                    </div>
                    <p className="text-sm">Speak to your agent to begin the transcript...</p>
                  </div>
                )}
                
                {transcript.map((entry, idx) => (
                  <div key={idx} className={`flex gap-4 ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex max-w-[80%] gap-3 ${entry.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
                        entry.role === 'user' ? 'bg-indigo-600' : 'bg-slate-800 border border-slate-700'
                      }`}>
                        {entry.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-indigo-400" />}
                      </div>
                      <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                        entry.role === 'user' 
                          ? 'bg-indigo-600 text-white rounded-tr-none' 
                          : 'bg-slate-800/50 text-slate-100 border border-slate-700/50 rounded-tl-none'
                      }`}>
                        {entry.text}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            </ScrollArea>
          </div>

          {error && (
            <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="h-24 bg-slate-900/50 rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden">
            {isConnected ? (
              <Waveform isActive={audioInputLevel > 0.01} variant="accent" />
            ) : (
              <p className="text-sm text-slate-500 italic">Press &quot;Start Conversation&quot; to begin</p>
            )}
          </div>
        </div>

        <DrawerFooter className="border-t border-slate-800 p-6">
          <div className="flex justify-center items-center gap-4">
            {!isConnected ? (
              <Button 
                onClick={start} 
                size="lg"
                className="bg-indigo-600 hover:bg-indigo-500 text-white min-w-[200px] h-14 rounded-full gap-2 text-lg shadow-lg shadow-indigo-500/20"
              >
                <div className="w-4 h-4 rounded-full bg-white/20 animate-pulse" />
                Start Conversation
              </Button>
            ) : (
              <Button 
                onClick={stop} 
                variant="destructive"
                size="lg"
                className="min-w-[200px] h-14 rounded-full gap-2 text-lg shadow-lg shadow-red-500/20"
              >
                <PhoneOff className="w-5 h-5" />
                End Session
              </Button>
            )}
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
