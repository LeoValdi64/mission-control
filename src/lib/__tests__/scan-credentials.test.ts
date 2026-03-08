/**
 * Tests for src/lib/secret-scanner.ts — scanForSecrets and redactSecrets
 */
import { describe, it, expect } from 'vitest'
import { scanForSecrets, redactSecrets } from '@/lib/secret-scanner'

describe('scanForSecrets', () => {
  it('detects AWS access key IDs', () => {
    const hits = scanForSecrets('My key is AKIAIOSFODNN7EXAMPLE')
    expect(hits.length).toBeGreaterThanOrEqual(1)
    expect(hits.some(h => h.type === 'aws_access_key')).toBe(true)
    expect(hits[0].severity).toBe('critical')
  })

  it('detects AWS secret access keys', () => {
    const hits = scanForSecrets('aws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEYaa')
    expect(hits.some(h => h.type === 'aws_secret_key')).toBe(true)
  })

  it('detects GitHub personal access tokens (ghp_)', () => {
    const token = 'ghp_' + 'A'.repeat(36)
    const hits = scanForSecrets(`token: ${token}`)
    expect(hits.some(h => h.type === 'github_token')).toBe(true)
    expect(hits[0].severity).toBe('critical')
  })

  it('detects GitHub OAuth tokens (gho_)', () => {
    const token = 'gho_' + 'B'.repeat(36)
    const hits = scanForSecrets(token)
    expect(hits.some(h => h.type === 'github_oauth_token')).toBe(true)
  })

  it('detects GitHub fine-grained PATs (github_pat_)', () => {
    const token = 'github_pat_' + 'C'.repeat(22)
    const hits = scanForSecrets(token)
    expect(hits.some(h => h.type === 'github_pat')).toBe(true)
  })

  it('detects Stripe live keys', () => {
    const key = 'sk_live_' + 'D'.repeat(24)
    const hits = scanForSecrets(key)
    expect(hits.some(h => h.type === 'stripe_secret_key')).toBe(true)
    expect(hits[0].severity).toBe('critical')
  })

  it('detects Stripe test keys with warning severity', () => {
    const key = 'sk_test_' + 'E'.repeat(24)
    const hits = scanForSecrets(key)
    expect(hits.some(h => h.type === 'stripe_test_key')).toBe(true)
    expect(hits.find(h => h.type === 'stripe_test_key')!.severity).toBe('warning')
  })

  it('detects JWTs', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    const hits = scanForSecrets(jwt)
    expect(hits.some(h => h.type === 'jwt')).toBe(true)
  })

  it('detects private keys (PEM)', () => {
    const hits = scanForSecrets('-----BEGIN RSA PRIVATE KEY-----\nMIIEow...')
    expect(hits.some(h => h.type === 'private_key')).toBe(true)
    expect(hits[0].severity).toBe('critical')
  })

  it('detects database connection strings', () => {
    const hits = scanForSecrets('postgres://user:pass@host:5432/mydb?sslmode=require')
    expect(hits.some(h => h.type === 'db_connection_string')).toBe(true)
    expect(hits[0].severity).toBe('critical')
  })

  it('detects mongodb+srv connection strings', () => {
    const hits = scanForSecrets('mongodb+srv://admin:pw123@cluster0.mongodb.net/db')
    expect(hits.some(h => h.type === 'db_connection_string')).toBe(true)
  })

  it('returns no false positives on normal text', () => {
    const hits = scanForSecrets('Hello, this is a normal message about deploying our application to production.')
    expect(hits).toHaveLength(0)
  })

  it('returns no false positives on code snippets', () => {
    const hits = scanForSecrets('const x = 42; function hello() { return "world"; }')
    expect(hits).toHaveLength(0)
  })

  it('returns redactedPreview for each match', () => {
    const hits = scanForSecrets('AKIAIOSFODNN7EXAMPLE')
    expect(hits[0].redactedPreview).toContain('***')
    expect(hits[0].redactedPreview).not.toBe('AKIAIOSFODNN7EXAMPLE')
  })

  it('includes position in match', () => {
    const text = 'prefix AKIAIOSFODNN7EXAMPLE suffix'
    const hits = scanForSecrets(text)
    expect(hits[0].position).toBe(7)
  })
})

describe('redactSecrets', () => {
  it('masks AWS keys in text', () => {
    const text = 'Key is AKIAIOSFODNN7EXAMPLE here'
    const result = redactSecrets(text)
    expect(result).toContain('***REDACTED***')
    expect(result).not.toContain('AKIAIOSFODNN7EXAMPLE')
  })

  it('masks GitHub tokens', () => {
    const token = 'ghp_' + 'A'.repeat(36)
    const result = redactSecrets(`Use ${token} for auth`)
    expect(result).toContain('***REDACTED***')
    expect(result).not.toContain(token)
  })

  it('preserves text without credentials', () => {
    const text = 'Just a normal message with nothing sensitive.'
    expect(redactSecrets(text)).toBe(text)
  })

  it('masks multiple credentials in one string', () => {
    const token = 'ghp_' + 'X'.repeat(36)
    const text = `AWS: AKIAIOSFODNN7EXAMPLE GitHub: ${token}`
    const result = redactSecrets(text)
    expect(result).not.toContain('AKIAIOSFODNN7EXAMPLE')
    expect(result).not.toContain(token)
  })
})
