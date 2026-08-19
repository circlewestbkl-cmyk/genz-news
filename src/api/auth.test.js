import { describe, it, expect } from 'vitest'
import { hasPermission, PERMISSIONS } from './auth'

describe('hasPermission (izin granular)', () => {
  it('admin punya izin kelola user, sampah & audit secara default', () => {
    expect(hasPermission({ role: 'admin' }, 'manageUsers')).toBe(true)
    expect(hasPermission({ role: 'admin' }, 'manageTrash')).toBe(true)
    expect(hasPermission({ role: 'admin' }, 'viewAudit')).toBe(true)
  })

  it('admin TIDAK punya izin berita secara default', () => {
    expect(hasPermission({ role: 'admin' }, 'publish')).toBe(false)
    expect(hasPermission({ role: 'admin' }, 'editAll')).toBe(false)
    expect(hasPermission({ role: 'admin' }, 'delete')).toBe(false)
  })

  it('editor punya izin berita & sampah secara default', () => {
    expect(hasPermission({ role: 'editor' }, 'publish')).toBe(true)
    expect(hasPermission({ role: 'editor' }, 'editAll')).toBe(true)
    expect(hasPermission({ role: 'editor' }, 'delete')).toBe(true)
    expect(hasPermission({ role: 'editor' }, 'manageTrash')).toBe(true)
    expect(hasPermission({ role: 'editor' }, 'manageUsers')).toBe(false)
  })

  it('penulis tanpa izin tambahan tidak punya izin apa pun', () => {
    expect(hasPermission({ role: 'writer' }, 'publish')).toBe(false)
    expect(hasPermission({ role: 'writer' }, 'manageTrash')).toBe(false)
    expect(hasPermission({ role: 'writer' }, 'editAll')).toBe(false)
  })

  it('izin tambahan lewat field permissions berlaku terlepas dari role', () => {
    const writer = { role: 'writer', permissions: ['publish', 'viewAudit'] }
    expect(hasPermission(writer, 'publish')).toBe(true)
    expect(hasPermission(writer, 'viewAudit')).toBe(true)
    expect(hasPermission(writer, 'editAll')).toBe(false)

    // Admin yang diberi izin publish bisa menerbitkan
    const admin = { role: 'admin', permissions: ['publish'] }
    expect(hasPermission(admin, 'publish')).toBe(true)
  })

  it('user null / tanpa data tidak punya izin', () => {
    expect(hasPermission(null, 'publish')).toBe(false)
    expect(hasPermission(undefined, 'manageUsers')).toBe(false)
  })

  it('semua izin terdaftar punya label & deskripsi', () => {
    for (const p of PERMISSIONS) {
      expect(p.key).toBeTruthy()
      expect(p.label).toBeTruthy()
      expect(p.desc).toBeTruthy()
    }
  })
})
