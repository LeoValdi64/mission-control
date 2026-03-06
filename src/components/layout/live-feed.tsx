'use client'

import { useMissionControl } from '@/store'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export function LiveFeed() {
  const { logs, sessions, activities, connection, dashboardMode, toggleLiveFeed } = useMissionControl()
  const isLocal = dashboardMode === 'local'
  const [expanded, setExpanded] = useState(true)
  const [hasCollapsed, setHasCollapsed] = useState(false)

  // Combine logs, activities, and (in local mode) session events into a unified feed
  const sessionItems = isLocal
    ? sessions.slice(0, 10).map(s => ({
        id: `sess-${s.id}`,
        type: 'session' as const,
        level: 'info' as const,
        message: `${s.active ? 'Active' : 'Idle'} session: ${s.key || s.id}`,
        source: s.model?.split('/').pop()?.split('-').slice(0, 2).join('-') || 'claude',
        timestamp: s.lastActivity || s.startTime || Date.now(),
      }))
    : []

  const feedItems = [
    ...logs.slice(0, 30).map(log => ({
      id: `log-${log.id}`,
      type: 'log' as const,
      level: log.level,
      message: log.message,
      source: log.source,
      timestamp: log.timestamp,
    })),
    ...activities.slice(0, 20).map(act => ({
      id: `act-${act.id}`,
      type: 'activity' as const,
      level: 'info' as const,
      message: act.description,
      source: act.actor,
      timestamp: act.created_at * 1000,
    })),
    ...sessionItems,
  ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 40)

  if (!expanded) {
    return (
      <div className="w-10 bg-card border-l border-border flex flex-col items-center py-3 shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setExpanded(true)}
          title="Show live feed"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 3l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Button>
        {/* Mini indicators */}
        <div className="mt-4 flex flex-col gap-2 items-center">
          {feedItems.slice(0, 5).map((item) => (
            <div
              key={item.id}
              className={`w-1.5 h-1.5 rounded-full ${
                item.level === 'error' ? 'bg-red-500' :
                item.level === 'warn' ? 'bg-amber-500' :
                'bg-blue-500/40'
              }`}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`w-72 h-full bg-card border-l border-border flex flex-col shrink-0${hasCollapsed ? ' slide-in-right' : ''}`}>
      {/* Header */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-dot" />
          <span className="text-xs font-semibold text-foreground">Live Feed</span>
          <span className="text-2xs text-muted-foreground font-mono-tight">{feedItems.length}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => { setExpanded(false); setHasCollapsed(true) }}
            className="w-6 h-6"
            title="Collapse feed"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={toggleLiveFeed}
            className="w-6 h-6"
            title="Close feed"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Feed items */}
      <div className="flex-1 overflow-y-auto">
        {feedItems.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-xs text-muted-foreground">No activity yet</p>
            <p className="text-2xs text-muted-foreground/60 mt-1">
              {isLocal
                ? 'Events appear when you create tasks or agents update'
                : 'Events stream here from the gateway and local DB'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {feedItems.map((item) => (
              <FeedItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* xint promo */}
      <a
        href="https://github.com/0xNyk/xint-rs"
        target="_blank"
        rel="noopener noreferrer"
        className="mx-2 mb-2 block rounded-lg border border-border/50 bg-surface-1 hover:bg-surface-2 hover:border-primary/30 transition-all duration-200 p-2.5 group"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">xint</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-mono">Rust CLI</span>
        </div>
        <p className="text-2xs text-muted-foreground leading-relaxed">X power tools — batch ops, analytics, audience intel. Built for agents.</p>
        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground/60 group-hover:text-primary/60 transition-colors">
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
          <span>0xNyk/xint-rs</span>
          <svg className="w-2.5 h-2.5 ml-auto" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3l6 5-6 5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </a>

      {/* builderz promo */}
      <a
        href="https://builderz.dev"
        target="_blank"
        rel="noopener noreferrer"
        className="mx-2 mb-2 block rounded-lg border border-void-cyan/20 bg-gradient-to-br from-void-cyan/5 to-transparent hover:from-void-cyan/10 hover:border-void-cyan/40 transition-all duration-200 p-2.5 group"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-foreground group-hover:text-void-cyan transition-colors">builderz</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-void-cyan/15 text-void-cyan">.dev</span>
        </div>
        <p className="text-2xs text-muted-foreground leading-relaxed">AI-native dev shop. We build agents, dashboards &amp; automations for teams that ship fast.</p>
        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-void-cyan/50 group-hover:text-void-cyan/80 transition-colors">
          <span>builderz.dev</span>
          <svg className="w-2.5 h-2.5 ml-auto" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3l6 5-6 5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </a>

      {/* Active sessions mini-list */}
      <div className="border-t border-border px-3 py-2 shrink-0">
        <div className="text-2xs font-medium text-muted-foreground mb-1.5">Active Sessions</div>
        <div className="space-y-1">
          {sessions.filter(s => s.active).slice(0, 4).map(session => (
            <div key={session.id} className="flex items-center gap-1.5 text-2xs">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-foreground truncate flex-1 font-mono-tight">{session.key || session.id}</span>
              <span className="text-muted-foreground">{session.model?.split('/').pop()?.slice(0, 8)}</span>
            </div>
          ))}
          {sessions.filter(s => s.active).length === 0 && (
            <div className="text-2xs text-muted-foreground">No active sessions</div>
          )}
        </div>
      </div>
    </div>
  )
}

function FeedItem({ item }: { item: { id: string; type: string; level: string; message: string; source: string; timestamp: number } }) {
  const levelIndicator = item.level === 'error'
    ? 'bg-red-500'
    : item.level === 'warn'
    ? 'bg-amber-500'
    : item.level === 'debug'
    ? 'bg-gray-500'
    : 'bg-blue-500/50'

  const timeStr = formatRelativeTime(item.timestamp)

  return (
    <div className="px-3 py-2 hover:bg-secondary/50 transition-smooth group">
      <div className="flex items-start gap-2">
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${levelIndicator}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-foreground/90 leading-relaxed break-words">
            {item.message.length > 120 ? item.message.slice(0, 120) + '...' : item.message}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-2xs text-muted-foreground font-mono-tight">{item.source}</span>
            <span className="text-2xs text-muted-foreground/50">·</span>
            <span className="text-2xs text-muted-foreground">{timeStr}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
  return `${Math.floor(diff / 86_400_000)}d`
}
