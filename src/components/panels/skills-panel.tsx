'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMissionControl } from '@/store'
import { Button } from '@/components/ui/button'

interface SkillSummary {
  id: string
  name: string
  source: string
  path: string
  description?: string
}

interface SkillGroup {
  source: string
  path: string
  skills: SkillSummary[]
}

interface SkillsResponse {
  skills: SkillSummary[]
  groups: SkillGroup[]
  total: number
}

interface SkillContentResponse {
  source: string
  name: string
  skillPath: string
  skillDocPath: string
  content: string
}

export function SkillsPanel() {
  const { dashboardMode } = useMissionControl()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SkillsResponse | null>(null)
  const [query, setQuery] = useState('')
  const [selectedSkill, setSelectedSkill] = useState<SkillSummary | null>(null)
  const [selectedContent, setSelectedContent] = useState<SkillContentResponse | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerError, setDrawerError] = useState<string | null>(null)
  const [createSource, setCreateSource] = useState('user-codex')
  const [createName, setCreateName] = useState('')
  const [createContent, setCreateContent] = useState('# new-skill\n\nDescribe this skill.\n')
  const [createError, setCreateError] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const loadSkills = useCallback(async (opts?: { initial?: boolean }) => {
    if (opts?.initial) setLoading(true)
    setError(null)
    const res = await fetch('/api/skills', { cache: 'no-store' })
    const body = await res.json()
    if (!res.ok) throw new Error(body?.error || 'Failed to load skills')
    setData(body as SkillsResponse)
    if (opts?.initial) setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        await loadSkills({ initial: true })
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load skills')
          setLoading(false)
        }
      }
    }
    run()
    return () => { cancelled = true }
  }, [loadSkills])

  // Two-way disk sync: poll for external on-disk changes.
  useEffect(() => {
    const id = window.setInterval(() => {
      loadSkills().catch(() => {})
    }, 10000)
    return () => window.clearInterval(id)
  }, [loadSkills])

  const filtered = useMemo(() => {
    const list = data?.skills || []
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((skill) => {
      const haystack = `${skill.name} ${skill.source} ${skill.description || ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [data?.skills, query])

  useEffect(() => {
    if (!selectedSkill) return
    const skill = selectedSkill
    let cancelled = false
    async function run() {
      setDrawerLoading(true)
      setDrawerError(null)
      setSelectedContent(null)
      try {
        const params = new URLSearchParams({
          mode: 'content',
          source: skill.source,
          name: skill.name,
        })
        const res = await fetch(`/api/skills?${params.toString()}`, { cache: 'no-store' })
        const body = await res.json()
        if (!res.ok) throw new Error(body?.error || 'Failed to load SKILL.md')
        if (!cancelled) setSelectedContent(body as SkillContentResponse)
      } catch (err: any) {
        if (!cancelled) setDrawerError(err?.message || 'Failed to load SKILL.md')
      } finally {
        if (!cancelled) setDrawerLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [selectedSkill])

  useEffect(() => {
    setDraftContent(selectedContent?.content || '')
  }, [selectedContent?.content])

  useEffect(() => {
    if (!selectedSkill) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedSkill(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedSkill])

  const refresh = async () => {
    setLoading(true)
    try {
      await loadSkills()
    } catch (err: any) {
      setError(err?.message || 'Failed to refresh skills')
    } finally {
      setLoading(false)
    }
  }

  const createSkill = async () => {
    setCreateError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: createSource,
          name: createName.trim(),
          content: createContent,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Failed to create skill')
      setCreateName('')
      await loadSkills()
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create skill')
    } finally {
      setSaving(false)
    }
  }

  const saveSkill = async () => {
    if (!selectedSkill) return
    setSaving(true)
    setDrawerError(null)
    try {
      const res = await fetch('/api/skills', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: selectedSkill.source,
          name: selectedSkill.name,
          content: draftContent,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Failed to save skill')
      await loadSkills()
      setSelectedContent((prev) => prev ? { ...prev, content: draftContent } : prev)
    } catch (err: any) {
      setDrawerError(err?.message || 'Failed to save skill')
    } finally {
      setSaving(false)
    }
  }

  const deleteSkill = async () => {
    if (!selectedSkill) return
    const ok = window.confirm(`Delete skill "${selectedSkill.name}"? This removes it from disk.`)
    if (!ok) return
    setSaving(true)
    setDrawerError(null)
    try {
      const params = new URLSearchParams({ source: selectedSkill.source, name: selectedSkill.name })
      const res = await fetch(`/api/skills?${params.toString()}`, { method: 'DELETE' })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Failed to delete skill')
      setSelectedSkill(null)
      setSelectedContent(null)
      await loadSkills()
    } catch (err: any) {
      setDrawerError(err?.message || 'Failed to delete skill')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Skills</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Installed skill packs available to agents in {dashboardMode === 'local' ? 'local mode' : 'gateway mode'}.
          </p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter skills..."
          className="h-9 w-full sm:w-72 rounded-md border border-border bg-secondary/50 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">Disk sync is active (auto-refresh every 10s)</div>
          <Button variant="outline" size="xs" onClick={refresh} disabled={loading || saving}>Refresh Now</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-2">
          <select
            value={createSource}
            onChange={(e) => setCreateSource(e.target.value)}
            className="h-9 rounded-md border border-border bg-secondary/50 px-2 text-xs text-foreground"
          >
            <option value="user-codex">user-codex</option>
            <option value="user-agents">user-agents</option>
            <option value="project-codex">project-codex</option>
            <option value="project-agents">project-agents</option>
          </select>
          <input
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="new-skill-name"
            className="h-9 rounded-md border border-border bg-secondary/50 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <Button variant="default" size="sm" onClick={createSkill} disabled={saving || !createName.trim()}>
            Add Skill
          </Button>
        </div>
        <textarea
          value={createContent}
          onChange={(e) => setCreateContent(e.target.value)}
          className="w-full h-24 rounded-md border border-border bg-secondary/30 p-2 text-xs text-foreground font-mono focus:outline-none"
          placeholder="Initial SKILL.md content"
        />
        {createError && <p className="text-xs text-destructive">{createError}</p>}
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">Loading skills...</div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-6 text-sm text-destructive">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {(data?.groups || []).map((group) => (
              <div key={group.source} className="rounded-lg border border-border bg-card p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{group.source}</div>
                <div className="mt-1 text-lg font-semibold text-foreground">{group.skills.length}</div>
                <div className="mt-1 text-2xs text-muted-foreground truncate">{group.path}</div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border text-xs text-muted-foreground">
              {filtered.length} of {data?.total || 0} skills
            </div>
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">No skills matched this filter.</div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((skill) => (
                  <div key={skill.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-sm text-foreground">{skill.name}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xs rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                          {skill.source}
                        </span>
                        <Button variant="outline" size="xs" onClick={() => setSelectedSkill(skill)}>
                          View
                        </Button>
                      </div>
                    </div>
                    {skill.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{skill.description}</p>
                    )}
                    <p className="mt-1 text-2xs text-muted-foreground/70 break-all">{skill.path}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {isMounted && selectedSkill && createPortal(
        <div className="fixed inset-0 z-[120]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedSkill(null)} />
          <aside className="absolute right-0 top-0 h-full w-[min(52rem,100vw)] bg-card border-l border-border shadow-2xl flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground truncate">{selectedSkill.name}</h3>
                <p className="text-2xs text-muted-foreground truncate">
                  {selectedSkill.source} • {selectedSkill.path}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="destructive" size="sm" onClick={deleteSkill} disabled={saving || drawerLoading}>
                  Delete
                </Button>
                <Button variant="outline" size="sm" onClick={saveSkill} disabled={saving || drawerLoading}>
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedSkill(null)}>Close</Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {drawerLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading SKILL.md...</div>
              ) : drawerError ? (
                <div className="p-4 text-sm text-destructive">{drawerError}</div>
              ) : selectedContent ? (
                <textarea
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  className="w-full h-full min-h-[70vh] bg-card p-4 text-xs text-muted-foreground leading-5 font-mono whitespace-pre rounded-none border-0 focus:outline-none"
                />
              ) : (
                <div className="p-4 text-sm text-muted-foreground">No content.</div>
              )}
            </div>
          </aside>
        </div>,
        document.body
      )}
    </div>
  )
}
