import { AnimeSource } from '../../../../base/AnimeSource'
import { Manga, MangaPage, Chapter, StreamingServer } from '../../../../types'
import * as cheerio from 'cheerio'

/**
 * WitAnime source adapter for https://witanime.site/
 */
export class WitAnimeSource extends AnimeSource {
  constructor() {
    super(
      'ma.autakimi.extension.ar.witanime',
      'WitAnime',
      '0.0.1',
      'https://witanime.site',
      'ar',
      'ma.autakimi.extension.ar.witanime',
      false
    )
  }

  override getFeedLabels(): Record<string, string> {
    return {
      popular: 'Directory',
      latest: 'Latest Episodes',
      search: 'Search'
    }
  }

  // ─── Lists ───────────────────────────────────────────────────────────────────

  async fetchPopular(page: number): Promise<MangaPage> {
    const url = page === 1 ? `${this.baseUrl}/browse` : `${this.baseUrl}/browse?page=${page}`
    return this._parseAnimeList(url)
  }

  async fetchLatest(page: number): Promise<MangaPage> {
    if (page === 1) {
      return this._parseAnimeList(`${this.baseUrl}/`)
    }
    return this._parseAnimeList(`${this.baseUrl}/browse?sort=latest&page=${page}`)
  }

  async searchManga(query: string, page: number): Promise<MangaPage> {
    if (!query) return this.fetchPopular(page)
    const url =
      page === 1
        ? `${this.baseUrl}/browse?search=${encodeURIComponent(query)}`
        : `${this.baseUrl}/browse?search=${encodeURIComponent(query)}&page=${page}`
    return this._parseAnimeList(url)
  }

  private async _parseAnimeList(url: string): Promise<MangaPage> {
    const html = await this.fetchHtml(url)
    if (!html) return { manga: [], hasNextPage: false }

    const $ = cheerio.load(html)
    const manga: Manga[] = []
    const seenUrls = new Set<string>()

    $('a').each((_, el) => {
      let animeUrl = $(el).attr('href') || ''
      if (!animeUrl || !animeUrl.includes('/anime/')) return

      if (animeUrl.startsWith('/')) {
        animeUrl = `${this.baseUrl}${animeUrl}`
      }

      if (seenUrls.has(animeUrl)) return
      seenUrls.add(animeUrl)

      let title =
        $(el).find('h2, h3, .title').text().trim() ||
        $(el).attr('title')?.trim() ||
        $(el).text().trim() ||
        'Untitled'

      // Clean up title
      title = title
        .replace(/\s+/g, ' ')
        .replace(/^TV\s+/i, '')
        .replace(/^Special\s+/i, '')
        .trim()
      if (!title || title === 'شاهد الآن') return

      let coverUrl =
        $(el).find('img').attr('src') ||
        $(el).find('img').attr('data-src') ||
        $(el).parent().find('img').attr('src') ||
        $(el).closest('div').find('img').attr('src') ||
        ''

      if (coverUrl.startsWith('/')) {
        coverUrl = `${this.baseUrl}${coverUrl}`
      }

      manga.push({
        id: animeUrl,
        title,
        coverUrl,
        url: animeUrl,
        status: 'TV',
        author: '',
        artist: '',
        description: '',
        genres: [],
        mediaType: 'anime'
      })
    })

    const hasNextPage = manga.length >= 20

    return { manga, hasNextPage }
  }

  // ─── Details ─────────────────────────────────────────────────────────────────

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
    const html = await this.fetchHtml(manga.url)
    if (!html) return manga

    const $ = cheerio.load(html)

    const title = $('h1').first().text().trim() || manga.title
    const description =
      $('p.story, .anime-story, p.description').first().text().trim() || manga.description

    let coverUrl =
      $('img[src*="/posters/"], img[src*="/banners/"]').first().attr('src') ||
      $('div.poster img, .anime-poster img').attr('src') ||
      manga.coverUrl

    if (coverUrl.startsWith('/')) {
      coverUrl = `${this.baseUrl}${coverUrl}`
    }

    const genres: string[] = []
    $('a[href*="/genre/"], a[href*="/genres/"]').each((_, el) => {
      const g = $(el).text().trim()
      if (g && !genres.includes(g)) genres.push(g)
    })

    return {
      ...manga,
      title,
      description,
      coverUrl,
      genres
    }
  }

  // ─── Episodes / Chapters ─────────────────────────────────────────────────────

  async fetchChapters(mangaUrl: string): Promise<Chapter[]> {
    const html = await this.fetchHtml(mangaUrl)
    if (!html) return []

    const $ = cheerio.load(html)
    const chapters: Chapter[] = []
    const seenUrls = new Set<string>()

    $('a[href*="/watch/"]').each((_, el) => {
      let epUrl = $(el).attr('href') || ''
      if (!epUrl) return

      if (epUrl.startsWith('/')) {
        epUrl = `${this.baseUrl}${epUrl}`
      }

      if (seenUrls.has(epUrl)) return
      seenUrls.add(epUrl)

      let title = $(el).text().trim() || 'Episode'
      title = title.replace(/\s+/g, ' ')
      if (title === 'شاهد الآن') return

      const numMatch = epUrl.match(/\/(\d+)(?:[/?#]|$)/) || title.match(/(\d+)/)
      const number = numMatch ? parseFloat(numMatch[1]) : chapters.length + 1

      chapters.push({
        id: epUrl,
        title: title.startsWith('الحلقة') ? title : `الحلقة ${number}`,
        url: epUrl,
        number,
        date: ''
      })
    })

    // Sort chronologically ascending
    chapters.sort((a, b) => a.number - b.number)

    return chapters
  }

  // ─── Video Players / Streaming Servers ───────────────────────────────────────

  async fetchPages(episodeUrl: string): Promise<StreamingServer[]> {
    const html = await this.fetchHtml(episodeUrl)
    const servers: StreamingServer[] = []

    if (html) {
      const $ = cheerio.load(html)
      const seenUrls = new Set<string>()

      // 1. Check iframes
      $('iframe').each((_, el) => {
        let src = $(el).attr('src') || ''
        if (src) {
          if (src.startsWith('//')) src = `https:${src}`
          else if (src.startsWith('/')) src = `${this.baseUrl}${src}`
          if (!seenUrls.has(src)) {
            seenUrls.add(src)
            servers.push({ name: 'Default Player', url: src })
          }
        }
      })

      // 2. Check embed links
      $('[data-url], [data-embed], a[href*="embed"]').each((_, el) => {
        const src = $(el).attr('data-url') || $(el).attr('data-embed') || $(el).attr('href') || ''
        if (src && src.startsWith('http') && !seenUrls.has(src)) {
          seenUrls.add(src)
          servers.push({ name: $(el).text().trim() || 'Stream Player', url: src })
        }
      })
    }

    // Always include the full webview player as primary or fallback
    if (servers.length === 0) {
      servers.push({ name: 'WitAnime Player', url: episodeUrl })
    }

    return servers
  }
}

export const config = {
  name: 'WitAnime',
  pkg: 'ma.autakimi.extension.ar.witanime',
  lang: 'ar',
  type: 'anime',
  version: '0.0.1',
  baseClass: 'Native',
  sources: [{ name: 'WitAnime', id: 'witanime', baseUrl: 'https://witanime.site' }]
}
