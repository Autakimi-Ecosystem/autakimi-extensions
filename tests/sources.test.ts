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
import { RistoAnimeSource } from '../src/extensions/anime/ar/ristoanime/index'
import { WitAnimeSource } from '../src/extensions/anime/ar/witanime/index'

describe('Native Sources Integration Tests', () => {
  it('RistoAnimeSource - fetchPopular should return manga', async () => {
    const source = new RistoAnimeSource()
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

    // Test fetchMangaDetails
    const details = await source.fetchMangaDetails(firstManga)
    expect(details.title).toBeDefined()
    expect(details.coverUrl).toBeDefined()
    expect(details.coverUrl.length).toBeGreaterThan(0)
  }, 15000)

  it('RistoAnimeSource - test specific anime URLs', async () => {
    const source = new RistoAnimeSource()
    const urls = [
      'https://ristoanime.cc/%d8%a7%d9%86%d9%85%d9%8a-ao-ashi-%d8%a7%d9%84%d9%85%d9%88%d8%b3%d9%85-2-%d8%a7%d9%84%d8%ad%d9%84%d9%82%d8%a9-8-%d9%85%d8%aa%d8%b1%d8%ac%d9%85%d8%a9-%d8%a7%d9%88%d9%86-%d9%84%d8%a7%d9%8a%d9%86/',
      'https://ristoanime.cc/series/karasu-wa-aruji/'
    ]
    for (const url of urls) {
      const details = await source.fetchMangaDetails({ url, id: url, title: '', pkg: '' } as any)
      expect(details.title).toBeTruthy()
      expect(details.coverUrl).toBeTruthy()
      expect(details.description).toBeTruthy()
    }
  }, 15000)

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

  it('WitAnimeSource - should initialize and have correct configuration', () => {
    const source = new WitAnimeSource()
    expect(source.id).toBe('ma.autakimi.extension.ar.witanime')
    expect(source.version).toBe('0.0.2')
    expect(source.baseUrl).toBe('https://witanime.site')
    expect(source.lang).toBe('ar')
    expect(source.mediaType).toBe('anime')
  })

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
