import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { listWorkspacesForTenant } from '@/lib/workspaces'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const db = getDatabase()
    const tenantId = auth.user.tenant_id ?? 1
    const workspaces = listWorkspacesForTenant(db, tenantId)
    return NextResponse.json({
      workspaces,
      active_workspace_id: auth.user.workspace_id,
      tenant_id: tenantId,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 })
  }
}

