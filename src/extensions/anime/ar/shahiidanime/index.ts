import { AnimeSource } from '../../../../base/AnimeSource'
import { Manga, MangaPage, Chapter, StreamingServer } from '../../../../types'
import * as cheerio from 'cheerio'

/**
 * ShahiidAnime source adapter for https://shahiid-anime.net/
 *
 * Site structure:
 *   Series list   → /series/page/{n}/     (grid of anime with .one-poster cards)
 *   Series detail → /series/{slug}/        (cover, description, genres, season links)
 *   Season detail → /seasons/{slug}/       (list of episodes for a season)
 *   Episode page  → /episodes/{slug}/      (iframe-based video player)
 *
 * We flatten Seasons into the "chapters" list so each season becomes a group of chapters.
 */
export class ShahiidAnimeSource extends AnimeSource {
  constructor() {
    super(
      'ma.autakimi.extension.ar.shahiidanime',
      'Shahiid Anime',
      '0.0.3',
      'https://shahiid-anime.net',
      'ar',
      'ma.autakimi.extension.ar.shahiidanime',
      false
    )
  }

  // ─── Lists ───────────────────────────────────────────────────────────────────

  async fetchPopular(page: number): Promise<MangaPage> {
    const url = `${this.baseUrl}/series/page/${page}/`
    return this._parseAnimeList(url)
  }

  async fetchLatest(page: number): Promise<MangaPage> {
    const url = `${this.baseUrl}/series/page/${page}/?order=latest`
    const result = await this._parseAnimeList(url)
    if (result.manga.length === 0) {
      return this._parseAnimeList(`${this.baseUrl}/series/page/${page}/`)
    }
    return result
  }

  async searchManga(query: string, page: number): Promise<MangaPage> {
    if (!query) return this.fetchPopular(page)
    const url = `${this.baseUrl}/page/${page}/?s=${encodeURIComponent(query)}`
    return this._parseAnimeList(url)
  }

  private async _parseAnimeList(url: string): Promise<MangaPage> {
    const html = await this.fetchHtml(url)
    if (!html) return { manga: [], hasNextPage: false }

    const $ = cheerio.load(html)
    const manga: Manga[] = []

    $('.one-poster, .listupd .bs, .listupd .bsx, article.box-item, .item.anime, .item.series').each(
      (_, el) => {
        const node = $(el)
        const a = node.find('a').first()
        const href = a.attr('href')
        if (!href) return

        const seriesUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`
        const title = (
          node.find('h2 a, .tt, .title, a[title], h3').first().text().trim() ||
          a.attr('title') ||
          ''
        ).replace(/\s+/g, ' ')
        if (!title) return

        const imgEl = node.find('img').first()
        const cover =
          imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || ''

        const typeBadge = (
          node
            .find('.typez, .type, span.Type, .rated-poster, .status-poster')
            .first()
            .text()
            .trim() || 'TV'
        ).replace(/\s+/g, ' ')
        const score = node.find('.numscore, .rate, .rating, .rated-poster').first().text().trim()

        manga.push({
          id: seriesUrl,
          title,
          coverUrl: cover,
          url: seriesUrl,
          status: score ? `${typeBadge} • ${score}`.replace(' •  • ', ' • ') : typeBadge,
          author: '',
          artist: '',
          description: '',
          genres: [],
          mediaType: 'anime'
        })
      }
    )

    const hasNextPage =
      $('.nextpostslink, a.next, .next.page-numbers, .nav-next a').length > 0 ||
      (manga.length > 0 && $('.pages .current').length > 0)

    return { manga, hasNextPage }
  }

  // ─── Series Detail ───────────────────────────────────────────────────────────

  async fetchMangaDetails(manga: Manga): Promise<Manga> {
    const html = await this.fetchHtml(manga.url || '')
    if (!html) return manga

    const $ = cheerio.load(html)

    const title =
      $('h1.entry-title, h1.seriestitle, .head-info h1, h1').first().text().trim() || manga.title

    let coverUrl = manga.coverUrl
    const coverImg = $('.head-post img, .thumb img, .seriesthumbnail img').first()
    const newCover = coverImg.attr('src') || coverImg.attr('data-src') || ''
    if (newCover) coverUrl = newCover

    const description =
      $('.entry-content p, .desc p, .synops p, .SeriesInfo p').first().text().trim() ||
      $('.entry-content, .desc, .synops').first().text().trim() ||
      ''

    const genres: string[] = []
    $('a[href*="/series-cats/"], a[href*="/genre/"], .gen-links a, .seriestugenre a').each(
      (_, el) => {
        const g = $(el).text().trim()
        if (g && !genres.includes(g)) genres.push(g)
      }
    )

    let status = manga.status || ''
    $('div, span').each((_, el) => {
      const text = $(el).text()
      if (text.includes('حالة الأنيمي') || text.includes('حالة الانمي')) {
        const val =
          $(el).find('a, span').first().text().trim() ||
          text.replace(/حالة الأنيمي|حالة الانمي|:/g, '').trim()
        if (val) status = val
      }
    })

    return {
      ...manga,
      title,
      coverUrl,
      description,
      genres,
      status: status || manga.status || 'Unknown'
    }
  }

  // ─── Episodes (Chapters) ─────────────────────────────────────────────────────

  /**
   * Fetches all episodes across all seasons for the given series URL.
   */
  async fetchChapters(mangaUrl: string): Promise<Chapter[]> {
    const html = await this.fetchHtml(mangaUrl)
    if (!html) return []

    const $ = cheerio.load(html)
    const allChapters: Chapter[] = []

    // 1. Direct episode links on page
    const directLinks: string[] = []
    $('a[href*="/episodes/"], a[href*="/episodesDubbed/"]').each((_, el) => {
      const href = $(el).attr('href') || ''
      if (href && !directLinks.includes(href)) directLinks.push(href)
    })

    // 2. Season links
    const seasonUrls: string[] = []
    $(`a[href*="/seasons/"], 
       .seasons-list a, 
       .mseason a, 
       .series-seasons a,
       a:contains("الموسم")`).each((_, el) => {
      let href = $(el).attr('href') || ''
      if (!href) return
      if (href.startsWith('/')) href = `${this.baseUrl}${href}`

      // Filter out utility links like ?serie=, search, report, or anchor links
      if (
        href.includes('?serie=') ||
        href.includes('?s=') ||
        href.includes('rapport') ||
        href.includes('تبليغ') ||
        href.includes('#')
      ) {
        return
      }

      if (!seasonUrls.includes(href)) seasonUrls.push(href)
    })

    // 3. Fallback: If no season links found, try body post ID aggregator URL
    if (seasonUrls.length === 0 && directLinks.length === 0) {
      const bodyClass = $('body').attr('class') || ''
      const postIdMatch = bodyClass.match(/postid-(\d+)/) || html.match(/postid-(\d+)/)
      const seriesId = postIdMatch ? postIdMatch[1] : null
      if (seriesId) {
        const aggregatorUrl = `${this.baseUrl}/seasons/?serie=${seriesId}`
        const aggregatorHtml = await this.fetchHtml(aggregatorUrl)
        if (aggregatorHtml) {
          const $agg = cheerio.load(aggregatorHtml)
          $agg('a[href*="/seasons/"], .listupd a, .bs a').each((_, el) => {
            let href = $agg(el).attr('href') || ''
            if (!href) return
            if (href.startsWith('/')) href = `${this.baseUrl}${href}`
            if (
              !href.includes('?serie=') &&
              !href.includes('?s=') &&
              !href.includes('rapport') &&
              !href.includes('تبليغ') &&
              !href.includes('#') &&
              !seasonUrls.includes(href)
            ) {
              seasonUrls.push(href)
            }
          })
        }
      }
    }

    // 4. Fetch episodes from each season
    if (seasonUrls.length > 0) {
      let globalIndex = 0
      for (const seasonUrl of seasonUrls) {
        const seasonChapters = await this._fetchSeasonEpisodes(seasonUrl, globalIndex)
        globalIndex += seasonChapters.length
        allChapters.push(...seasonChapters)
      }
    } else if (directLinks.length > 0) {
      // Episodes are directly on the initial page
      const chapters = await this._fetchSeasonEpisodes(mangaUrl, 0)
      allChapters.push(...chapters)
    }

    // Deduplicate and sort chronologically ascending
    const finalChapters = Array.from(new Map(allChapters.map((c) => [c.url, c])).values())
    finalChapters.sort((a, b) => a.number - b.number)
    return finalChapters
  }

  private async _fetchSeasonEpisodes(seasonUrl: string, startIndex = 0): Promise<Chapter[]> {
    const html = await this.fetchHtml(seasonUrl)
    if (!html) return []

    const $ = cheerio.load(html)
    const seasonTitle = $('h1.entry-title, h1.seriestitle, h1').first().text().trim()
    const epsMap = new Map<string, { href: string; text: string; num: number; date?: string }>()

    $('a[href*="/episodes/"], a[href*="/episodesDubbed/"]').each((i, el) => {
      let href = $(el).attr('href') || ''
      if (!href) return
      if (href.startsWith('/')) href = `${this.baseUrl}${href}`

      if ($(el).hasClass('dlBtn') || href.includes('?download=')) return

      const rawText = $(el).text().trim().replace(/\s+/g, ' ')
      const titleAttr = $(el).attr('title')?.trim() || ''
      const text = titleAttr || rawText

      const numMatch =
        text.match(/(?:الحلقة|حلقة|ep|episode)\s*(\d+(?:\.\d+)?)/i) ||
        href.match(/(?:ep-|episode-)(\d+(?:\.\d+)?)/i) ||
        decodeURIComponent(href).match(/الحلقة-(\d+(?:\.\d+)?)/i) ||
        text.match(/(\d+(?:\.\d+)?)/)

      const num = numMatch ? parseFloat(numMatch[1]) : startIndex + i + 1

      const dateStr = $(el)
        .closest('li, article, .epRow, div, p')
        .find('.date, .epl-date, time')
        .text()
        .trim()

      if (!epsMap.has(href)) {
        epsMap.set(href, { href, text, num, date: dateStr || undefined })
      } else {
        const existing = epsMap.get(href)!
        if (text.includes('الحلقة') && !existing.text.includes('الحلقة')) {
          existing.text = text
        } else if (text.length > existing.text.length && !text.includes('مشاهدة')) {
          existing.text = text
        }
      }
    })

    const chapters: Chapter[] = []
    let idx = startIndex
    for (const [epUrl, epData] of epsMap.entries()) {
      idx++
      const num = isNaN(epData.num) ? idx : epData.num
      let title = epData.text
      if (!title || title === 'مشاهدة الحلقة' || title === 'تحميل الحلقة') {
        title = seasonTitle ? `${seasonTitle} - الحلقة ${num}` : `الحلقة ${num}`
      }
      chapters.push({
        id: epUrl,
        title,
        url: epUrl,
        number: num,
        date: epData.date
      })
    }

    chapters.sort((a, b) => a.number - b.number)
    return chapters
  }

  // ─── Video Players / Streaming Servers ───────────────────────────────────────

  async fetchPages(episodeUrl: string): Promise<StreamingServer[]> {
    const html = await this.fetchHtml(episodeUrl)
    if (!html) return [{ name: 'Web View Player', url: episodeUrl }]

    const $ = cheerio.load(html)
    const servers: StreamingServer[] = []
    const seenUrls = new Set<string>()

    const addServer = (name: string, streamUrl: string) => {
      let sUrl = (streamUrl || '').trim()
      if (!sUrl) return
      if (sUrl.startsWith('//')) sUrl = `https:${sUrl}`
      else if (sUrl.startsWith('/')) sUrl = `${this.baseUrl}${sUrl}`

      if (
        !seenUrls.has(sUrl) &&
        sUrl.startsWith('http') &&
        !sUrl.includes('facebook') &&
        !sUrl.includes('twitter') &&
        !sUrl.includes('instagram') &&
        !sUrl.includes('youtube') &&
        !sUrl.includes('t.me')
      ) {
        seenUrls.add(sUrl)
        servers.push({ name, url: sUrl })
      }
    }

    // 1. Resolve server buttons via AJAX GET request (Sendvid, Videa, Okru, Dood, etc.)
    const buttons: { label: string; post: string; serverId: string; serv: string }[] = []
    $('.movies-servers a.buttosn, .tabs-ul a.buttosn').each((_, el) => {
      const post = $(el).attr('data-post')
      const serverId = $(el).attr('data-server-id')
      const serv = $(el).attr('data-serv')
      const label = $(el).text().trim().replace(/\s+/g, ' ') || 'Server'
      if (post && serverId && serv) {
        buttons.push({ label, post, serverId, serv })
      }
    })

    if (buttons.length > 0) {
      await Promise.all(
        buttons.map(async (b) => {
          try {
            const params = new URLSearchParams({
              action: 'codecanal_ajax_request',
              post: b.post,
              server_id: b.serverId,
              serv: b.serv
            })
            const ajaxUrl = `${this.baseUrl}/wp-admin/admin-ajax.php?${params.toString()}`
            const res = await this.fetchHtml(ajaxUrl, {
              headers: {
                'X-Requested-With': 'XMLHttpRequest',
                Referer: episodeUrl
              }
            })
            if (res) {
              const match = res.match(/src=["']([^"']+)["']/i)
              if (match && match[1]) {
                addServer(b.label, match[1])
              }
            }
          } catch {}
        })
      )
    }

    // 2. Primary iframes in player containers
    $(
      'div#services-cntn-ajax iframe, .movies-servers iframe, #player iframe, .player iframe, iframe'
    ).each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || ''
      if (src) addServer('Default Player', src)
    })

    // 3. Download page if available
    const downloadLink = $('a[href*="?download="]').first().attr('href')
    if (downloadLink) {
      try {
        const dUrl = downloadLink.startsWith('/') ? `${this.baseUrl}${downloadLink}` : downloadLink
        const dHtml = await this.fetchHtml(dUrl)
        if (dHtml) {
          const $d = cheerio.load(dHtml)
          $d('a').each((_, el) => {
            const href = $d(el).attr('href') || ''
            const text = $d(el).text().trim().replace(/\s+/g, ' ')
            if (href.startsWith('http') && !href.includes('shahiid-anime.net')) {
              addServer(text || 'Download Server', href)
            }
          })
        }
      } catch {}
    }

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

    enhancedServers.sort((a, b) => {
      const aDirect = a.type === 'hls' || a.type === 'mp4' ? 1 : 0
      const bDirect = b.type === 'hls' || b.type === 'mp4' ? 1 : 0
      return bDirect - aDirect
    })

    return enhancedServers
  }
}

export const config = {
  name: 'ShahiidAnime',
  pkg: 'ma.autakimi.extension.ar.shahiidanime',
  lang: 'ar',
  type: 'anime',
  version: '0.0.3',
  status: 'supported',
  isFullySupported: true,
  baseClass: 'Native',
  sources: [{ name: 'Shahiid Anime', id: '67890', baseUrl: 'https://shahiid-anime.net' }]
}
