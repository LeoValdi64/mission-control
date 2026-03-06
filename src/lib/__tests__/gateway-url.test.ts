import { describe, expect, it } from 'vitest'
import { buildGatewayWebSocketUrl } from '@/lib/gateway-url'

describe('buildGatewayWebSocketUrl', () => {
  it('builds ws URL with host and port for local dev', () => {
    expect(buildGatewayWebSocketUrl({
      host: '127.0.0.1',
      port: 18789,
      browserProtocol: 'http:',
    })).toBe('ws://127.0.0.1:18789')
  })

  it('omits 18789 for remote hosts on https browser context', () => {
    expect(buildGatewayWebSocketUrl({
      host: 'cb-vcn.tail47c878.ts.net',
      port: 18789,
      browserProtocol: 'https:',
    })).toBe('wss://cb-vcn.tail47c878.ts.net')
  })

  it('keeps explicit websocket URL host value unchanged aside from protocol normalization', () => {
    expect(buildGatewayWebSocketUrl({
      host: 'https://gateway.example.com',
      port: 18789,
      browserProtocol: 'https:',
    })).toBe('wss://gateway.example.com')
  })

  it('preserves explicit URL port when provided in host', () => {
    expect(buildGatewayWebSocketUrl({
      host: 'https://gateway.example.com:8443',
      port: 18789,
      browserProtocol: 'https:',
    })).toBe('wss://gateway.example.com:8443')
  })

  it('preserves token query while dropping unrelated path/query/hash from pasted dashboard URL', () => {
    expect(buildGatewayWebSocketUrl({
      host: 'https://bill.tail8b4599.ts.net:4443/sessions?foo=bar&token=abc123#frag',
      port: 18789,
      browserProtocol: 'https:',
    })).toBe('wss://bill.tail8b4599.ts.net:4443?token=abc123')
  })
})
