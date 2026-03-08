/**
 * Secret Scanner — detects leaked credentials and sensitive tokens in text.
 *
 * Pure regex-based scanner with patterns for common secret formats.
 * Used by hook profiles to gate whether secrets should be scanned/blocked.
 */

export type SecretSeverity = 'info' | 'warning' | 'critical'

export interface SecretMatch {
  type: string
  severity: SecretSeverity
  redactedPreview: string
  position: number
}

interface SecretPattern {
  type: string
  severity: SecretSeverity
  regex: RegExp
}

const SECRET_PATTERNS: SecretPattern[] = [
  // AWS Access Key IDs
  { type: 'aws_access_key', severity: 'critical', regex: /AKIA[0-9A-Z]{16}/g },
  // AWS Secret Access Keys (40 chars base64-ish after common prefixes)
  { type: 'aws_secret_key', severity: 'critical', regex: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*[A-Za-z0-9/+=]{40}/g },

  // GitHub tokens
  { type: 'github_token', severity: 'critical', regex: /gh[ps]_[A-Za-z0-9_]{36,255}/g },
  { type: 'github_oauth_token', severity: 'critical', regex: /gho_[A-Za-z0-9_]{36,255}/g },
  { type: 'github_pat', severity: 'critical', regex: /github_pat_[A-Za-z0-9_]{22,255}/g },

  // Stripe keys
  { type: 'stripe_secret_key', severity: 'critical', regex: /sk_live_[A-Za-z0-9]{24,99}/g },
  { type: 'stripe_test_key', severity: 'warning', regex: /sk_test_[A-Za-z0-9]{24,99}/g },

  // Generic API key patterns (key=... or api_key=...)
  { type: 'generic_api_key', severity: 'warning', regex: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[=:]\s*['"]?[A-Za-z0-9_\-]{20,64}['"]?/gi },

  // JWTs
  { type: 'jwt', severity: 'warning', regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_\-+/=]{10,}/g },

  // Private keys (PEM)
  { type: 'private_key', severity: 'critical', regex: /-----BEGIN\s(?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },

  // Database connection strings
  { type: 'db_connection_string', severity: 'critical', regex: /(?:postgres|postgresql|mysql|mongodb|mongodb\+srv|redis):\/\/[^\s'"]{10,}/gi },
]

export function scanForSecrets(text: string): SecretMatch[] {
  const matches: SecretMatch[] = []

  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.regex.exec(text)) !== null) {
      const value = match[0]
      const preview = value.length > 12
        ? value.slice(0, 6) + '***' + value.slice(-3)
        : value.slice(0, 3) + '***'
      matches.push({
        type: pattern.type,
        severity: pattern.severity,
        redactedPreview: preview,
        position: match.index,
      })
    }
  }

  return matches
}

export function redactSecrets(text: string): string {
  let result = text
  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0
    result = result.replace(pattern.regex, (match) => {
      if (match.length > 12) {
        return match.slice(0, 6) + '***REDACTED***' + match.slice(-3)
      }
      return match.slice(0, 3) + '***REDACTED***'
    })
  }
  return result
}
