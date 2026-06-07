import { vi, describe, it, expect } from 'vitest'

// Mock DataService since it's an Electron renderer construct
vi.mock('@renderer/shared/api', () => ({
  DataService: {
    fetchRepo: async (url: string) => {
      // Very basic polyfill for the native sources like MangaDex
      const res = await fetch(url)
      const data = await res.json()
      return data
    }
  }
}))

// Import sources to test
import { MangaDexSource } from '../src/extensions/manga/all/mangadex/index'
import { ShahiidAnimeSource } from '../src/extensions/anime/ar/shahiidanime/index'

describe('Native Sources Integration Tests', () => {
  it('ShahiidAnimeSource - fetchPopular should return manga', async () => {
    const source = new ShahiidAnimeSource()
    const result = await source.fetchPopular(1)

    expect(result).toBeDefined()
    expect(result.manga).toBeInstanceOf(Array)
    expect(result.manga.length).toBeGreaterThan(0)

    // Verify structure
    const firstManga = result.manga[0]
    expect(firstManga.id).toBeDefined()
    expect(firstManga.title).toBeDefined()
    expect(firstManga.url).toBeDefined()
    expect(firstManga.coverUrl).toBeDefined()
  }, 15000)

  it('MangaDexSource - fetchPopular should return manga', async () => {
    const source = new MangaDexSource()
    const result = await source.fetchPopular(1)

    expect(result).toBeDefined()
    expect(result.manga).toBeInstanceOf(Array)
    expect(result.manga.length).toBeGreaterThan(0)

    // Verify structure
    const firstManga = result.manga[0]
    expect(firstManga.id).toBeDefined()
    expect(firstManga.title).toBeDefined()
    expect(firstManga.url).toBeDefined()
  }, 15000)
})
