import { describe, it, expect } from 'vitest'
import versionDefault, { version, build, environment, compatibility } from '@/lib/version'

describe('version module', () => {
  it('exports a version string', () => {
    expect(version).toBe('1.0.0')
  })

  it('exports a build string', () => {
    expect(typeof build).toBe('string')
    expect(build.length).toBeGreaterThan(0)
  })

  it('exports an environment string', () => {
    expect(typeof environment).toBe('string')
  })

  it('exports compatibility info', () => {
    expect(compatibility.api).toBe('v1')
    expect(compatibility.mcp).toBe('1.0')
    expect(compatibility.wcag).toBe('2.2')
    expect(compatibility.node).toBe('>=20.0.0')
    expect(compatibility.nextjs).toBe('>=15.0.0')
  })

  it('exports default object with all fields', () => {
    expect(versionDefault).toHaveProperty('version')
    expect(versionDefault).toHaveProperty('build')
    expect(versionDefault).toHaveProperty('timestamp')
    expect(versionDefault).toHaveProperty('environment')
    expect(versionDefault).toHaveProperty('compatibility')
    expect(versionDefault).toHaveProperty('vercel')
  })
})
