'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useMissionControl } from '@/store'
import { useNavigateToPanel } from '@/lib/navigation'

interface Setting {
  key: string
  value: string
  description: string
  category: string
  updated_by: string | null
  updated_at: number | null
  is_default: boolean
}

const categoryLabels: Record<string, { label: string; icon: string; description: string }> = {
  general: { label: 'General', icon: '⚙', description: 'Core Mission Control settings' },
  retention: { label: 'Data Retention', icon: '🗄', description: 'How long data is kept before cleanup' },
  gateway: { label: 'Gateway', icon: '🔌', description: 'OpenClaw gateway connection settings' },
  custom: { label: 'Custom', icon: '🔧', description: 'User-defined settings' },
}

const categoryOrder = ['general', 'retention', 'gateway', 'custom']

// Dropdown options for subscription plan settings
const subscriptionDropdowns: Record<string, { label: string; value: string }[]> = {
  'subscription.plan_override': [
    { label: 'Auto-detect', value: '' },
    { label: 'Pro ($20/mo)', value: 'pro' },
    { label: 'Max ($100/mo)', value: 'max' },
    { label: 'Max 5x ($200/mo)', value: 'max_5x' },
    { label: 'Team ($30/mo)', value: 'team' },
    { label: 'Enterprise', value: 'enterprise' },
  ],
  'subscription.codex_plan': [
    { label: 'None', value: '' },
    { label: 'ChatGPT Free ($0/mo)', value: 'chatgpt' },
    { label: 'Plus ($20/mo)', value: 'plus' },
    { label: 'Pro ($200/mo)', value: 'pro' },
    { label: 'Team ($30/mo)', value: 'team' },
  ],
}

export function SettingsPanel() {
  const { currentUser } = useMissionControl()
  const navigateToPanel = useNavigateToPanel()
  const [settings, setSettings] = useState<Setting[]>([])
  const [grouped, setGrouped] = useState<Record<string, Setting[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)

  // Track edited values (key -> new value)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [activeCategory, setActiveCategory] = useState('general')

  const showFeedback = (ok: boolean, text: string) => {
    setFeedback({ ok, text })
    setTimeout(() => setFeedback(null), 3000)
  }

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.status === 401) {
        window.location.assign('/login?next=%2Fsettings')
        return
      }
      if (res.status === 403) {
        setError('Admin access required')
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to load settings')
        return
      }
      const data = await res.json()
      setSettings(data.settings || [])
      setGrouped(data.grouped || {})
    } catch {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleEdit = (key: string, value: string) => {
    setEdits(prev => ({ ...prev, [key]: value }))
  }

  const hasChanges = Object.keys(edits).some(key => {
    const setting = settings.find(s => s.key === key)
    return setting && edits[key] !== setting.value
  })

  const handleSave = async () => {
    // Filter only actual changes
    const changes: Record<string, string> = {}
    for (const [key, value] of Object.entries(edits)) {
      const setting = settings.find(s => s.key === key)
      if (setting && value !== setting.value) {
        changes[key] = value
      }
    }

    if (Object.keys(changes).length === 0) return

    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: changes }),
      })
      const data = await res.json()
      if (res.ok) {
        showFeedback(true, `Saved ${data.count} setting${data.count === 1 ? '' : 's'}`)
        setEdits({})
        fetchSettings()
      } else {
        showFeedback(false, data.error || 'Failed to save')
      }
    } catch {
      showFeedback(false, 'Network error')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async (key: string) => {
    try {
      const res = await fetch(`/api/settings?key=${encodeURIComponent(key)}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        showFeedback(true, `Reset "${key}" to default`)
        setEdits(prev => {
          const next = { ...prev }
          delete next[key]
          return next
        })
        fetchSettings()
      } else {
        showFeedback(false, data.error || 'Failed to reset')
      }
    } catch {
      showFeedback(false, 'Network error')
    }
  }

  const handleDiscard = () => {
    setEdits({})
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Loading settings...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">{error}</div>
      </div>
    )
  }

  const categories = categoryOrder.filter(c => grouped[c]?.length > 0)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Configure Mission Control behavior and retention policies</p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button
              onClick={handleDiscard}
              variant="outline"
              size="sm"
            >
              Discard
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            variant={hasChanges ? 'default' : 'secondary'}
            size="sm"
            className={!hasChanges ? 'cursor-not-allowed' : ''}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Workspace Info */}
      {currentUser?.role === 'admin' && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300">
          <strong className="text-blue-200">Workspace Management:</strong>{' '}
          To create or manage workspaces (tenant instances), go to the{' '}
          <Button
            onClick={() => navigateToPanel('super-admin')}
            variant="link"
            size="xs"
            className="text-blue-400 hover:text-blue-300 p-0 h-auto"
          >
            Super Admin
          </Button>{' '}
          panel under Admin &gt; Super Admin in the sidebar. From there you can create new client instances, manage tenants, and monitor provisioning jobs.
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className={`rounded-lg p-3 text-xs font-medium ${
          feedback.ok ? 'bg-green-500/10 text-green-400' : 'bg-destructive/10 text-destructive'
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1 border-b border-border pb-px">
        {categories.map(cat => {
          const meta = categoryLabels[cat] || { label: cat, icon: '📋', description: '' }
          const changedCount = (grouped[cat] || []).filter(s => edits[s.key] !== undefined && edits[s.key] !== s.value).length
          return (
            <Button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              variant="ghost"
              size="sm"
              className={`rounded-t-md rounded-b-none relative ${
                activeCategory === cat
                  ? 'bg-card text-foreground border border-border border-b-card -mb-px'
                  : ''
              }`}
            >
              {meta.label}
              {changedCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-2xs rounded-full bg-primary text-primary-foreground">
                  {changedCount}
                </span>
              )}
            </Button>
          )
        })}
      </div>

      {/* Settings list for active category */}
      <div className="space-y-3">
        {(grouped[activeCategory] || []).map(setting => {
          const currentValue = edits[setting.key] ?? setting.value
          const isChanged = edits[setting.key] !== undefined && edits[setting.key] !== setting.value
          const isBooleanish = setting.value === 'true' || setting.value === 'false'
          const isNumeric = /^\d+$/.test(setting.value)
          const dropdownOptions = subscriptionDropdowns[setting.key]
          const shortKey = setting.key.split('.').pop() || setting.key

          return (
            <div
              key={setting.key}
              className={`bg-card border rounded-lg p-4 transition-colors ${
                isChanged ? 'border-primary/50' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{formatLabel(shortKey)}</span>
                    {setting.is_default && (
                      <span className="text-2xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">default</span>
                    )}
                    {isChanged && (
                      <span className="text-2xs px-1.5 py-0.5 rounded bg-primary/15 text-primary">modified</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
                  <p className="text-2xs text-muted-foreground/60 mt-1 font-mono">{setting.key}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {dropdownOptions ? (
                    <select
                      value={currentValue}
                      onChange={e => handleEdit(setting.key, e.target.value)}
                      className="w-48 px-2 py-1 text-sm bg-background border border-border rounded-md focus:border-primary focus:outline-none"
                    >
                      {dropdownOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : isBooleanish ? (
                    <button
                      onClick={() => handleEdit(setting.key, currentValue === 'true' ? 'false' : 'true')}
                      className={`w-10 h-5 rounded-full relative transition-colors select-none ${
                        currentValue === 'true' ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        currentValue === 'true' ? 'left-5' : 'left-0.5'
                      }`} />
                    </button>
                  ) : isNumeric ? (
                    <input
                      type="number"
                      value={currentValue}
                      onChange={e => handleEdit(setting.key, e.target.value)}
                      className="w-24 px-2 py-1 text-sm text-right bg-background border border-border rounded-md focus:border-primary focus:outline-none font-mono"
                    />
                  ) : (
                    <input
                      type="text"
                      value={currentValue}
                      onChange={e => handleEdit(setting.key, e.target.value)}
                      className="w-48 px-2 py-1 text-sm bg-background border border-border rounded-md focus:border-primary focus:outline-none"
                    />
                  )}

                  {!setting.is_default && (
                    <Button
                      onClick={() => handleReset(setting.key)}
                      title="Reset to default"
                      variant="ghost"
                      size="icon-xs"
                      className="w-6 h-6"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 8a6 6 0 1111.3-2.8" strokeLinecap="round" />
                        <path d="M14 2v3.5h-3.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Button>
                  )}
                </div>
              </div>

              {setting.updated_by && setting.updated_at && (
                <div className="text-2xs text-muted-foreground/50 mt-2">
                  Last updated by {setting.updated_by} on {new Date(setting.updated_at * 1000).toLocaleDateString()}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Unsaved changes bar */}
      {hasChanges && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg shadow-lg px-4 py-2.5 flex items-center gap-3 z-40">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs text-foreground">
            {Object.keys(edits).filter(k => {
              const s = settings.find(s => s.key === k)
              return s && edits[k] !== s.value
            }).length} unsaved change(s)
          </span>
          <Button
            onClick={handleDiscard}
            variant="ghost"
            size="xs"
          >
            Discard
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            size="xs"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}
    </div>
  )
}

/** Convert snake_case key to Title Case label */
function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}
