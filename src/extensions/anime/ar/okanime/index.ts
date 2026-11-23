import { AnimeSource } from '../../../../base/AnimeSource'
import { Manga, MangaPage, Chapter, StreamingServer } from '../../../../types'
import * as cheerio from 'cheerio'

/**
 * OKAnime source adapter for https://ww3.okanime.xyz/
 */
export class OKAnimeSource extends AnimeSource {
  constructor() {
    super(
      'ma.autakimi.extension.ar.okanime',
      'OKAnime',
      '0.0.1',
      'https://ww3.okanime.xyz',
      'ar',
      'ma.autakimi.extension.ar.okanime',
      false
    )
  }

  override getFeedLabels(): Record<string, string> {
    return {
      popular: 'Anime List',
      latest: 'Latest Episodes',
      search: 'Search'
    }
  }

  // ─── Lists ───────────────────────────────────────────────────────────────────

  async fetchPopular(page: number): Promise<MangaPage> {
    const url =
      page === 1 ? `${this.baseUrl}/anime-list` : `${this.baseUrl}/anime-list?page=${page}`
    return this._parseAnimeList(url)
  }

  async fetchLatest(page: number): Promise<MangaPage> {
    if (page === 1) {
      return this._parseAnimeList(`${this.baseUrl}/`)
    }
    return this._parseAnimeList(`${this.baseUrl}/anime-list?page=${page}`)
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

    // 1. Parse .anime-card elements
    $('div.anime-card').each((_, el) => {
      const card = $(el)
      const linkEl =
        card.find('.anime-title h4 a').first().length > 0
          ? card.find('.anime-title h4 a').first()
          : card.find('a[href*="/anime/"]').first()

      let animeUrl = linkEl.attr('href') || ''
      if (!animeUrl) return

      if (animeUrl.startsWith('/')) {
        animeUrl = `${this.baseUrl}${animeUrl}`
      }

      if (seenUrls.has(animeUrl)) return
      seenUrls.add(animeUrl)

      const title =
        card.find('.anime-title h4 a span').text().trim() ||
        card.find('.anime-title h4 a').text().trim() ||
        card.find('.anime-details h3').text().trim() ||
        card
          .find('img')
          .attr('alt')
          ?.replace(/\s*\|\s*اوك انمي.*$/i, '')
          .trim() ||
        'Untitled'

      let coverUrl =
        card.find('.anime-image img').attr('src') ||
        card.find('img').attr('src') ||
        card.find('img').attr('data-src') ||
        ''

      if (coverUrl.startsWith('/')) {
        coverUrl = `${this.baseUrl}${coverUrl}`
      }

      const status = card.find('.anime-details small').text().trim() || 'TV'

      manga.push({
        id: animeUrl,
        title,
        coverUrl,
        url: animeUrl,
        status,
        author: '',
        artist: '',
        description: card.find('.anime-details p').text().trim(),
        genres: card
          .find('.anime-details ul li')
          .map((_, li) => $(li).text().trim())
          .get()
          .filter(Boolean),
        mediaType: 'anime'
      })
    })

    // 2. Fallback for homepage latest episodes or other card formats
    if (manga.length === 0) {
      $('a[href*="/anime/"]').each((_, el) => {
        const link = $(el)
        let animeUrl = link.attr('href') || ''
        if (!animeUrl || seenUrls.has(animeUrl)) return
        if (animeUrl.startsWith('/')) animeUrl = `${this.baseUrl}${animeUrl}`

        const title = link.text().trim().replace(/\s+/g, ' ') || link.attr('title') || ''
        if (!title || title.length < 2) return

        seenUrls.add(animeUrl)
        const img = link.find('img').attr('src') || link.find('img').attr('data-src') || ''
        manga.push({
          id: animeUrl,
          title,
          coverUrl: img.startsWith('/') ? `${this.baseUrl}${img}` : img,
          url: animeUrl,
          status: 'TV',
          author: '',
          artist: '',
          description: '',
          genres: [],
          mediaType: 'anime'
        })
      })
    }

    const hasNextPage =
      $('a.next, a[rel="next"], .pagination a:contains("التالي")').length > 0 || manga.length >= 20

    return { manga, hasNextPage }
  }

  // ─── Details ─────────────────────────────────────────────────────────────────

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
    let url = manga.url
    if (url.includes('okanime.') && !url.startsWith(this.baseUrl)) {
      url = url.replace(/^https?:\/\/[^/]+/, this.baseUrl)
    }

    const html = await this.fetchHtml(url)
    if (!html) return manga

    const $ = cheerio.load(html)

    const title = $('h1').first().text().trim() || $('.anime-title').text().trim() || manga.title

    const description =
      $('.anime-story').text().trim() ||
      $('.story').text().trim() ||
      $('.anime-details p').text().trim() ||
      $('p.text-muted:contains("قصة")').text().trim() ||
      manga.description

    let coverUrl =
      $('picture img').first().attr('src') ||
      $('.anime-poster img').attr('src') ||
      $('img.img-responsive').first().attr('src') ||
      manga.coverUrl

    if (coverUrl.startsWith('/')) {
      coverUrl = `${this.baseUrl}${coverUrl}`
    }

    const genres: string[] = []
    $('a[href*="/genre/"]').each((_, el) => {
      const g = $(el).text().trim()
      if (g && !genres.includes(g)) genres.push(g)
    })

    let status = $('li:contains("حالة")').text().replace('حالة', '').trim() || manga.status

    if (status.includes('مكتمل')) status = 'Completed'
    else if (status.includes('مستمر') || status.includes('يعرض الآن')) status = 'Ongoing'

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
    if (url.includes('okanime.') && !url.startsWith(this.baseUrl)) {
      url = url.replace(/^https?:\/\/[^/]+/, this.baseUrl)
    }

    const html = await this.fetchHtml(url)
    if (!html) return []

    const $ = cheerio.load(html)
    const chapters: Chapter[] = []
    const seenUrls = new Set<string>()

    // Extract slug from anime URL to only match this anime's episodes
    const animeSlug = url.split('/anime/')[1]?.replace(/\/$/, '') || ''

    $(
      '.ep-compact-grid a, a[data-track-card="episode"], a.ep-compact-btn, a[href*="/episode/"]'
    ).each((_, el) => {
      let epUrl = $(el).attr('href') || ''
      if (!epUrl) return

      if (epUrl.startsWith('/')) {
        epUrl = `${this.baseUrl}${epUrl}`
      }

      // If animeSlug is known, avoid matching unrelated sidebar episodes
      if (animeSlug && !epUrl.includes(animeSlug)) {
        return
      }

      if (seenUrls.has(epUrl)) return
      seenUrls.add(epUrl)

      // Try position attribute first (clean number)
      const posAttr = $(el).attr('data-track-position')
      let num = posAttr ? parseFloat(posAttr) : NaN

      const epText = $(el).text().trim().replace(/\s+/g, ' ')
      const titleAttr = $(el).attr('title') || ''

      if (isNaN(num)) {
        const numMatch =
          epUrl.match(/episode-(\d+(?:\.\d+)?)/i) ||
          titleAttr.match(/الحلقة\s*(\d+(?:\.\d+)?)/i) ||
          epText.match(/(\d+(?:\.\d+)?)/)
        num = numMatch ? parseFloat(numMatch[1]) : chapters.length + 1
      }

      const title = titleAttr || (epText ? `الحلقة ${epText}` : `Episode ${num}`)

      chapters.push({
        id: epUrl,
        title,
        url: epUrl,
        number: isNaN(num) ? chapters.length + 1 : num,
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
    if (url.includes('okanime.') && !url.startsWith(this.baseUrl)) {
      url = url.replace(/^https?:\/\/[^/]+/, this.baseUrl)
    }

    const html = await this.fetchHtml(url)
    if (!html) return []

    const $ = cheerio.load(html)
    const servers: StreamingServer[] = []
    const seenUrls = new Set<string>()

    const addServer = (name: string, streamUrl: string) => {
      let sUrl = streamUrl.trim()
      if (!sUrl) return
      if (sUrl.startsWith('//')) sUrl = `https:${sUrl}`
      else if (sUrl.startsWith('/')) sUrl = `${this.baseUrl}${sUrl}`

      if (!seenUrls.has(sUrl) && sUrl.startsWith('http')) {
        seenUrls.add(sUrl)
        servers.push({ name, url: sUrl })
      }
    }

    // 1. Extract from #streamlinks @click or data-server
    $('#streamlinks a').each((_, el) => {
      const clickAttr = $(el).attr('@click') || ''
      const setMatch = clickAttr.match(/setServer\(['"]([^'"]+)['"]\)/)
      const serverHost =
        $(el).attr('data-server') || $(el).text().trim().replace(/\s+/g, ' ') || 'Server'
      const quality = $(el).attr('data-umami-event-quality') || ''

      if (setMatch) {
        const label = quality ? `${serverHost} (${quality})` : serverHost
        addServer(label, setMatch[1])
      }
    })

    // 2. Extract from download links tab
    $('#download a.ep-link, a[data-track-control="download_source"]').each((_, el) => {
      const href = $(el).attr('href') || ''
      const host = $(el).attr('data-umami-event-host') || 'Download'
      const quality =
        $(el).attr('data-umami-event-quality') || $(el).find('span').text().trim() || ''
      const label = quality ? `${host} [${quality}]` : host
      addServer(label, href)
    })

    // 3. Extract schema.org VideoObject embedUrl
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '{}')
        if (json['@type'] === 'VideoObject' && json.embedUrl) {
          addServer('Default Video', json.embedUrl)
        }
      } catch {}
    })

    // 4. Extract any iframe
    $('iframe').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr(':src') || ''
      if (src && !src.startsWith(':') && !src.includes('activeUrl')) {
        addServer('Default Player', src)
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
        enhancedServers.push({
          name: s.name,
          url: s.url
        })
      }
    }

    // Prioritize direct native servers first
    enhancedServers.sort((a, b) => {
      const aDirect = a.type === 'hls' || a.type === 'mp4' ? 1 : 0
      const bDirect = b.type === 'hls' || b.type === 'mp4' ? 1 : 0
      return bDirect - aDirect
    })

    return enhancedServers
  }
}

export const config = {
  name: 'OKAnime',
  pkg: 'ma.autakimi.extension.ar.okanime',
  lang: 'ar',
  type: 'anime',
  version: '0.0.1',
  status: 'supported',
  isFullySupported: true,
  baseClass: 'Native',
  sources: [{ name: 'OKAnime', id: 'okanime', baseUrl: 'https://ww3.okanime.xyz' }]
}
