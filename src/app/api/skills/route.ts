import { NextRequest, NextResponse } from 'next/server'
import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { requireRole } from '@/lib/auth'
import { resolveWithin } from '@/lib/paths'

interface SkillSummary {
  id: string
  name: string
  source: string
  path: string
  description?: string
}

type SkillRoot = { source: string; path: string }

async function pathReadable(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK)
    return true
  } catch {
    return false
  }
}

async function extractDescription(skillPath: string): Promise<string | undefined> {
  const skillDocPath = join(skillPath, 'SKILL.md')
  if (!(await pathReadable(skillDocPath))) return undefined
  try {
    const content = await readFile(skillDocPath, 'utf8')
    const lines = content.split('\n').map((line) => line.trim()).filter(Boolean)
    const firstParagraph = lines.find((line) => !line.startsWith('#'))
    if (!firstParagraph) return undefined
    return firstParagraph.length > 220 ? `${firstParagraph.slice(0, 217)}...` : firstParagraph
  } catch {
    return undefined
  }
}

async function collectSkillsFromDir(baseDir: string, source: string): Promise<SkillSummary[]> {
  if (!(await pathReadable(baseDir))) return []
  try {
    const entries = await readdir(baseDir, { withFileTypes: true })
    const out: SkillSummary[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const skillPath = join(baseDir, entry.name)
      const skillDocPath = join(skillPath, 'SKILL.md')
      if (!(await pathReadable(skillDocPath))) continue
      out.push({
        id: `${source}:${entry.name}`,
        name: entry.name,
        source,
        path: skillPath,
        description: await extractDescription(skillPath),
      })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

function getSkillRoots(): SkillRoot[] {
  const home = homedir()
  const cwd = process.cwd()
  return [
    { source: 'user-agents', path: join(home, '.agents', 'skills') },
    { source: 'user-codex', path: join(home, '.codex', 'skills') },
    { source: 'project-codex', path: join(cwd, '.codex', 'skills') },
    { source: 'project-agents', path: join(cwd, '.agents', 'skills') },
  ]
}

function normalizeSkillName(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) return null
  return value
}

function getRootBySource(roots: SkillRoot[], sourceRaw: string | null): SkillRoot | null {
  const source = String(sourceRaw || '').trim()
  if (!source) return null
  return roots.find((r) => r.source === source) || null
}

async function upsertSkill(root: SkillRoot, name: string, content: string) {
  const skillPath = resolveWithin(root.path, name)
  const skillDocPath = resolveWithin(skillPath, 'SKILL.md')
  await mkdir(skillPath, { recursive: true })
  await writeFile(skillDocPath, content, 'utf8')
  return { skillPath, skillDocPath }
}

async function deleteSkill(root: SkillRoot, name: string) {
  const skillPath = resolveWithin(root.path, name)
  await rm(skillPath, { recursive: true, force: true })
  return { skillPath }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const roots = getSkillRoots()
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode')

  if (mode === 'content') {
    const source = String(searchParams.get('source') || '')
    const name = normalizeSkillName(String(searchParams.get('name') || ''))
    if (!source || !name) {
      return NextResponse.json({ error: 'source and valid name are required' }, { status: 400 })
    }
    const root = roots.find((r) => r.source === source)
    if (!root) return NextResponse.json({ error: 'Invalid source' }, { status: 400 })
    const skillPath = join(root.path, name)
    const skillDocPath = join(skillPath, 'SKILL.md')
    if (!(await pathReadable(skillDocPath))) {
      return NextResponse.json({ error: 'SKILL.md not found' }, { status: 404 })
    }
    const content = await readFile(skillDocPath, 'utf8')
    return NextResponse.json({
      source,
      name,
      skillPath,
      skillDocPath,
      content,
    })
  }

  const bySource = await Promise.all(
    roots.map(async (root) => ({
      source: root.source,
      path: root.path,
      skills: await collectSkillsFromDir(root.path, root.source),
    }))
  )

  const all = bySource.flatMap((group) => group.skills)
  const deduped = new Map<string, SkillSummary>()
  for (const skill of all) {
    if (!deduped.has(skill.name)) deduped.set(skill.name, skill)
  }

  return NextResponse.json({
    skills: Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name)),
    groups: bySource,
    total: deduped.size,
  })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const roots = getSkillRoots()
  const body = await request.json().catch(() => ({}))
  const root = getRootBySource(roots, body?.source)
  const name = normalizeSkillName(String(body?.name || ''))
  const contentRaw = typeof body?.content === 'string' ? body.content : ''
  const content = contentRaw.trim() || `# ${name || 'skill'}\n\nDescribe this skill.\n`

  if (!root || !name) {
    return NextResponse.json({ error: 'Valid source and name are required' }, { status: 400 })
  }

  await mkdir(root.path, { recursive: true })
  const { skillPath, skillDocPath } = await upsertSkill(root, name, content)
  return NextResponse.json({ ok: true, source: root.source, name, skillPath, skillDocPath })
}

export async function PUT(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const roots = getSkillRoots()
  const body = await request.json().catch(() => ({}))
  const root = getRootBySource(roots, body?.source)
  const name = normalizeSkillName(String(body?.name || ''))
  const content = typeof body?.content === 'string' ? body.content : null

  if (!root || !name || content == null) {
    return NextResponse.json({ error: 'Valid source, name, and content are required' }, { status: 400 })
  }

  await mkdir(root.path, { recursive: true })
  const { skillPath, skillDocPath } = await upsertSkill(root, name, content)
  return NextResponse.json({ ok: true, source: root.source, name, skillPath, skillDocPath })
}

export async function DELETE(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const roots = getSkillRoots()
  const root = getRootBySource(roots, searchParams.get('source'))
  const name = normalizeSkillName(String(searchParams.get('name') || ''))
  if (!root || !name) {
    return NextResponse.json({ error: 'Valid source and name are required' }, { status: 400 })
  }

  const { skillPath } = await deleteSkill(root, name)
  return NextResponse.json({ ok: true, source: root.source, name, skillPath })
}

export const dynamic = 'force-dynamic'
