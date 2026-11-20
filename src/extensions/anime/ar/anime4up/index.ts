import { AnimeSource } from '../../../../base/AnimeSource'
import { Manga, MangaPage, Chapter, StreamingServer } from '../../../../types'
import * as cheerio from 'cheerio'

/**
 * Anime4Up source adapter for https://anime4up.quest/
 */
export class Anime4UpSource extends AnimeSource {
  constructor() {
    super(
      'ma.autakimi.extension.ar.anime4up',
      'Anime4Up',
      '0.0.1',
      'https://anime4up.quest',
      'ar',
      'ma.autakimi.extension.ar.anime4up',
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
    const url = page === 1 ? `${this.baseUrl}/search` : `${this.baseUrl}/search?page=${page}`
    return this._parseAnimeList(url)
  }

  async fetchLatest(page: number): Promise<MangaPage> {
    if (page === 1) {
      return this._parseAnimeList(`${this.baseUrl}/`)
    }
    return this._parseAnimeList(`${this.baseUrl}/search?sort=latest&page=${page}`)
  }

  async searchManga(query: string, page: number): Promise<MangaPage> {
    if (!query) return this.fetchPopular(page)
    const url =
      page === 1
        ? `${this.baseUrl}/search?q=${encodeURIComponent(query)}`
        : `${this.baseUrl}/search?q=${encodeURIComponent(query)}&page=${page}`
    return this._parseAnimeList(url)
  }

  private async _parseAnimeList(url: string): Promise<MangaPage> {
    const html = await this.fetchHtml(url)
    if (!html) return { manga: [], hasNextPage: false }

    const $ = cheerio.load(html)
    const manga: Manga[] = []
    const seenUrls = new Set<string>()

    $('div.anime-card').each((_, el) => {
      const card = $(el)
      const linkEl =
        card.find('h3.card-title a').first().length > 0
          ? card.find('h3.card-title a').first()
          : card.find('a.card-media').first()

      let animeUrl = linkEl.attr('href') || ''
      if (!animeUrl) return

      if (animeUrl.startsWith('/')) {
        animeUrl = `${this.baseUrl}${animeUrl}`
      }

      if (seenUrls.has(animeUrl)) return
      seenUrls.add(animeUrl)

      const title =
        card.find('h3.card-title a').text().trim() ||
        card.find('img').attr('alt')?.trim() ||
        'Untitled'

      let coverUrl = card.find('img').attr('src') || card.find('img').attr('data-src') || ''

      if (coverUrl.startsWith('/')) {
        coverUrl = `${this.baseUrl}${coverUrl}`
      }

      const status = card.find('span.card-type-badge').text().trim() || 'TV'

      manga.push({
        id: animeUrl,
        title,
        coverUrl,
        url: animeUrl,
        status,
        author: '',
        artist: '',
        description: '',
        genres: [],
        mediaType: 'anime'
      })
    })

    const hasNextPage = manga.length > 0 && $('a.next, a[rel="next"], .pagination-next').length > 0

    return { manga, hasNextPage: hasNextPage || manga.length >= 15 }
  }

  // ─── Details ─────────────────────────────────────────────────────────────────

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
    let url = manga.url
    if (url.includes('anime4up.') && !url.startsWith(this.baseUrl)) {
      url = url.replace(/^https?:\/\/[^/]+/, this.baseUrl)
    }

    const html = await this.fetchHtml(url)
    if (!html) return manga

    const $ = cheerio.load(html)

    const title = $('h1').first().text().trim() || $('.anime-title').text().trim() || manga.title

    const description =
      $('.anime-story').text().trim() ||
      $('.story').text().trim() ||
      $('.entry-content').text().trim() ||
      $('p:contains("قصة")').first().text().trim() ||
      $('p').first().text().trim() ||
      manga.description

    let coverUrl =
      $('.anime-poster img').attr('src') ||
      $('.anime-poster img').attr('data-src') ||
      $('div.poster img').attr('src') ||
      manga.coverUrl

    if (coverUrl.startsWith('/')) {
      coverUrl = `${this.baseUrl}${coverUrl}`
    }

    const genres: string[] = []
    $('a[href*="/genre/"]').each((_, el) => {
      const g = $(el).text().trim()
      if (g && !genres.includes(g)) genres.push(g)
    })

    let status =
      $('.anime-info-item:contains("حالة الأنمي")').text().replace('حالة الأنمي', '').trim() ||
      $('p:contains("حالة")').text().trim() ||
      manga.status

    if (status.includes('مكتمل')) status = 'Completed'
    else if (status.includes('مستمر')) status = 'Ongoing'

    return {
      ...manga,
      url,
      id: url,
      title,
      description,
      coverUrl,
      genres,
      status
    }
  }

  // ─── Episodes / Chapters ─────────────────────────────────────────────────────

  async fetchChapters(mangaUrl: string): Promise<Chapter[]> {
    let url = mangaUrl
    if (url.includes('anime4up.') && !url.startsWith(this.baseUrl)) {
      url = url.replace(/^https?:\/\/[^/]+/, this.baseUrl)
    }

    const html = await this.fetchHtml(url)
    if (!html) return []

    const $ = cheerio.load(html)
    const chapters: Chapter[] = []
    const seenUrls = new Set<string>()

    $('a[href*="/episode/"]').each((_, el) => {
      let epUrl = $(el).attr('href') || ''
      if (!epUrl) return

      if (epUrl.startsWith('/')) {
        epUrl = `${this.baseUrl}${epUrl}`
      } else if (epUrl.includes('anime4up.') && !epUrl.startsWith(this.baseUrl)) {
        epUrl = epUrl.replace(/^https?:\/\/[^/]+/, this.baseUrl)
      }

      if (seenUrls.has(epUrl)) return
      seenUrls.add(epUrl)

      let title = $(el).text().trim() || $(el).attr('title') || 'Episode'
      title = title.replace(/\s+/g, ' ')

      // 1. Attribute data-ep-num on element is the canonical episode number
      const epNumAttr = $(el).attr('data-ep-num')
      let number: number | null = null
      if (epNumAttr) {
        const parsed = parseFloat(epNumAttr)
        if (!isNaN(parsed)) number = parsed
      }

      // 2. Extract from title text (e.g. "الحلقة 1" or "Episode 1")
      if (number === null) {
        const titleMatch =
          title.match(/(?:الحلقة|episode|ep)[^\d]*(\d+(?:\.\d+)?)/i) ||
          title.match(/(\d+(?:\.\d+)?)/)
        if (titleMatch) {
          number = parseFloat(titleMatch[1])
        }
      }

      // 3. Extract from end of decoded URL slug (never match season prefix)
      if (number === null) {
        try {
          const slug = epUrl.split('/').filter(Boolean).pop() || ''
          const decodedSlug = decodeURIComponent(slug)
          const slugMatch =
            decodedSlug.match(/(?:الحلقة|episode|ep)[^\d]*(\d+(?:\.\d+)?)/i) ||
            decodedSlug.match(/-(\d+(?:\.\d+)?)(?:[/-]|$)/)
          if (slugMatch) {
            number = parseFloat(slugMatch[1])
          }
        } catch {}
      }

      if (number === null) {
        number = chapters.length + 1
      }

      chapters.push({
        id: epUrl,
        title,
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
    let url = episodeUrl
    if (url.includes('anime4up.') && !url.startsWith(this.baseUrl)) {
      url = url.replace(/^https?:\/\/[^/]+/, this.baseUrl)
    }

    const html = await this.fetchHtml(url)
    if (!html) return []

    const $ = cheerio.load(html)
    const servers: StreamingServer[] = []
    const seenUrls = new Set<string>()

    // 1. Extract from server buttons with data-stream-url
    $('button.server-btn, [data-stream-url]').each((_, el) => {
      let rawStream = $(el).attr('data-stream-url') || ''
      const label =
        $(el).attr('data-server-label') ||
        $(el).attr('data-server-host') ||
        $(el).text().trim().replace(/\s+/g, ' ') ||
        'Server'

      if (rawStream) {
        if (rawStream.startsWith('//')) rawStream = `https:${rawStream}`
        else if (rawStream.startsWith('/')) rawStream = `${this.baseUrl}${rawStream}`

        if (!seenUrls.has(rawStream)) {
          seenUrls.add(rawStream)
          servers.push({ name: label, url: rawStream })
        }
      }
    })

    // 2. Extract from iframes
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

    // Fallback: episode page URL itself for webview
    if (servers.length === 0) {
      servers.push({ name: 'Web View Player', url: episodeUrl })
    }

    const enhancedServers: StreamingServer[] = []
    for (const s of servers) {
      const direct = await this.resolveDirectStream(s.url)
      if (direct) {
        enhancedServers.push({
          name: `${s.name} ⚡ Direct`,
          url: direct.url,
          type: direct.type as any,
          headers: direct.headers
        })
      } else {
        let fallbackUrl = s.url
        if (s.url.includes('player.php?url=')) {
          try {
            const urlObj = new URL(s.url)
            const inner = urlObj.searchParams.get('url')
            if (inner) fallbackUrl = inner
          } catch {}
        }
        enhancedServers.push({
          name: s.name,
          url: fallbackUrl
        })
      }
    }

    // Prioritize direct native servers first so user gets instant ad-free native playback
    enhancedServers.sort((a, b) => {
      const aDirect = a.type === 'hls' || a.type === 'mp4' ? 1 : 0
      const bDirect = b.type === 'hls' || b.type === 'mp4' ? 1 : 0
      return bDirect - aDirect
    })

    return enhancedServers
  }
}

export const config = {
  name: 'Anime4Up',
  pkg: 'ma.autakimi.extension.ar.anime4up',
  lang: 'ar',
  type: 'anime',
  version: '0.0.1',
  baseClass: 'Native',
  sources: [{ name: 'Anime4Up', id: 'anime4up', baseUrl: 'https://anime4up.quest' }]
}
