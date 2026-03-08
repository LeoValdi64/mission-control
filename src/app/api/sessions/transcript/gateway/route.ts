import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'
import { logger } from '@/lib/logger'

const GATEWAY_BASE = `http://${config.gatewayHost}:${config.gatewayPort}`

/**
 * GET /api/sessions/transcript/gateway?key=<session-key>&limit=50
 *
 * Fetches the message history for a gateway session by calling the
 * OpenClaw gateway HTTP API: GET /api/sessions/{key}/messages
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const sessionKey = searchParams.get('key') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)

  if (!sessionKey) {
    return NextResponse.json({ error: 'key is required' }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    const encodedKey = encodeURIComponent(sessionKey)
    const res = await fetch(
      `${GATEWAY_BASE}/api/sessions/${encodedKey}/messages?limit=${limit}`,
      { signal: controller.signal }
    )
    clearTimeout(timer)

    if (!res.ok) {
      // Gateway might not support this endpoint yet — return empty gracefully
      if (res.status === 404) {
        return NextResponse.json({ messages: [], source: 'gateway', note: 'Session messages endpoint not available on this gateway version' })
      }
      const text = await res.text().catch(() => '')
      logger.warn({ status: res.status, body: text }, 'Gateway session messages fetch failed')
      return NextResponse.json({ messages: [], source: 'gateway', error: `Gateway returned ${res.status}` })
    }

    const data = await res.json()

    // Normalize gateway message format to our transcript format
    const messages = normalizeGatewayMessages(data, limit)

    return NextResponse.json({ messages, source: 'gateway' })
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return NextResponse.json({ messages: [], source: 'gateway', error: 'Gateway timeout' })
    }
    logger.warn({ err }, 'Gateway session transcript fetch failed')
    return NextResponse.json({ messages: [], source: 'gateway', error: 'Gateway unreachable' })
  }
}

type MessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: string }
  | { type: 'tool_result'; toolUseId: string; content: string; isError?: boolean }

interface TranscriptMessage {
  role: 'user' | 'assistant' | 'system'
  parts: MessageContentPart[]
  timestamp?: string
}

function normalizeGatewayMessages(data: any, limit: number): TranscriptMessage[] {
  // The gateway may return messages in various formats.
  // Try common structures: { messages: [...] }, [...], { history: [...] }
  let rawMessages: any[] = []
  if (Array.isArray(data)) {
    rawMessages = data
  } else if (Array.isArray(data?.messages)) {
    rawMessages = data.messages
  } else if (Array.isArray(data?.history)) {
    rawMessages = data.history
  } else if (Array.isArray(data?.transcript)) {
    rawMessages = data.transcript
  }

  const out: TranscriptMessage[] = []

  for (const msg of rawMessages) {
    if (!msg || typeof msg !== 'object') continue

    const role = msg.role === 'assistant' ? 'assistant' as const
      : msg.role === 'system' ? 'system' as const
      : 'user' as const

    const parts: MessageContentPart[] = []
    const ts = typeof msg.timestamp === 'string' ? msg.timestamp
      : typeof msg.created_at === 'string' ? msg.created_at
      : typeof msg.ts === 'string' ? msg.ts
      : undefined

    // Simple string content
    if (typeof msg.content === 'string' && msg.content.trim()) {
      parts.push({ type: 'text', text: msg.content.trim().slice(0, 8000) })
    }
    // Array content blocks (Claude API format)
    else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (!block || typeof block !== 'object') continue
        if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
          parts.push({ type: 'text', text: block.text.trim().slice(0, 8000) })
        } else if (block.type === 'thinking' && typeof block.thinking === 'string') {
          parts.push({ type: 'thinking', thinking: block.thinking.slice(0, 4000) })
        } else if (block.type === 'tool_use') {
          parts.push({
            type: 'tool_use',
            id: block.id || '',
            name: block.name || 'unknown',
            input: JSON.stringify(block.input || {}).slice(0, 500),
          })
        } else if (block.type === 'tool_result') {
          const content = typeof block.content === 'string' ? block.content
            : Array.isArray(block.content) ? block.content.map((c: any) => c?.text || '').join('\n')
            : ''
          if (content.trim()) {
            parts.push({
              type: 'tool_result',
              toolUseId: block.tool_use_id || '',
              content: content.trim().slice(0, 8000),
              isError: block.is_error === true,
            })
          }
        }
      }
    }
    // Simple text field
    else if (typeof msg.text === 'string' && msg.text.trim()) {
      parts.push({ type: 'text', text: msg.text.trim().slice(0, 8000) })
    }
    // Message field
    else if (typeof msg.message === 'string' && msg.message.trim()) {
      parts.push({ type: 'text', text: msg.message.trim().slice(0, 8000) })
    }

    if (parts.length > 0) {
      out.push({ role, parts, timestamp: ts })
    }
  }

  return out.slice(-limit)
}

export const dynamic = 'force-dynamic'
