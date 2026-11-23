import { ISourceAdapter, Manga, Chapter, MangaPage, FetchOptions, StreamingServer } from '../types'
import { safeUrl } from './urlUtils'

export { safeUrl }

/**
 * Base class for anime streaming sources.
 * Treats anime series like "manga" and episodes like "chapters".
 */
export abstract class AnimeSource implements ISourceAdapter {
  public theme: string = 'anime'
  public mediaType: 'manga' | 'anime' = 'anime'

  constructor(
    public id: string,
    public name: string,
    public version: string,
    public baseUrl: string,
    public lang: string,
    public icon: string,
    public nsfw: boolean = false
  ) {}

  public isCfChallengePage(html?: string): boolean {
    if (!html) return false
    const lower = html.toLowerCase()
    return (
      lower.includes('challenges.cloudflare.com') ||
      lower.includes('cf-browser-verification') ||
      lower.includes('turnstile') ||
      lower.includes('just a moment') ||
      lower.includes('checking your browser') ||
      lower.includes('verifying you are human') ||
      html.includes('لحظة واحدة من فضلك') ||
      html.includes('التحقق من أنك إنسان') ||
      html.includes('جاري التحقق') ||
      html.includes('يرجى الانتظار')
    )
  }

  /**
   * Helper to resolve common third-party embeds (Vidmoly, Uqload, Mp4Upload, Sendvid, etc.)
   * into direct HLS (.m3u8) or direct video (.mp4) streams for native playback.
   */
  public async resolveDirectStream(
    embedUrl: string
  ): Promise<{ url: string; type: 'hls' | 'mp4'; headers?: Record<string, string> } | null> {
    try {
      if (!embedUrl || !embedUrl.startsWith('http')) return null
      const cleanEmbedUrl = embedUrl.split('?')[0]
      const lower = cleanEmbedUrl.toLowerCase()

      let embedOrigin = ''
      try {
        const u = new URL(cleanEmbedUrl)
        embedOrigin = `${u.protocol}//${u.host}/`
      } catch {}

      const refHeader = {
        Referer: embedOrigin || (this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`)
      }

      // 0. Anime4Up & Site-specific player.php (HLS proxy & direct stream decoder)
      if (embedUrl.includes('player.php')) {
        const html = await this.fetchHtml(embedUrl, { headers: refHeader })
        if (html) {
          if (
            html.includes('<div class="dead-notice">') ||
            html.includes('تم حذف الملف من المصدر')
          ) {
            return null
          }
          const sourceMatch = html.match(/sourceUrl\s*=\s*"([^"]+)"/)
          const typeMatch = html.match(/streamType\s*=\s*"([^"]+)"/)
          if (sourceMatch) {
            const rawSource = sourceMatch[1].replace(/\\/g, '')
            const isMp4 =
              (typeMatch && typeMatch[1] === 'mp4') ||
              rawSource.includes('.mp4') ||
              rawSource.includes('stream_proxy')
            return {
              url: rawSource,
              type: isMp4 ? 'mp4' : 'hls',
              headers: { Referer: this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/` }
            }
          }
          const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i)
          if (iframeMatch) {
            let innerSrc = iframeMatch[1]
            if (innerSrc.startsWith('//')) innerSrc = `https:${innerSrc}`
            else if (innerSrc.startsWith('/')) innerSrc = `${this.baseUrl}${innerSrc}`
            const subRes = await this.resolveDirectStream(innerSrc)
            if (subRes) return subRes
          }
        }
      }

      // 1. Vidmoly (.m3u8)
      if (lower.includes('vidmoly')) {
        let targetUrl = cleanEmbedUrl
        if (targetUrl.includes('/w/')) {
          targetUrl = targetUrl.replace('/w/', '/embed-') + '.html'
        }
        const html = await this.fetchHtml(targetUrl, { headers: refHeader })
        if (html) {
          const m3u8Match =
            html.match(/file\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/) ||
            html.match(/sources\s*:\s*\[\{\s*file:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/) ||
            html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/)
          if (m3u8Match) {
            return {
              url: m3u8Match[1],
              type: 'hls',
              headers: { Referer: 'https://vidmoly.to/' }
            }
          }
        }
      }

      // 2. Uqload (.m3u8)
      if (lower.includes('uqload')) {
        const codeMatch =
          cleanEmbedUrl.match(/(?:embed-|[\/=])([a-zA-Z0-9]{8,24})(?:\.html|\/|$)/) ||
          cleanEmbedUrl.match(/\/([a-zA-Z0-9]+)(?:\?|\.html|$)/)
        if (codeMatch) {
          const code = codeMatch[1]
          const postUrl = 'https://uqload.vc/dl'
          const html = await this.fetchHtml(postUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Referer: cleanEmbedUrl
            },
            body: `op=embed&file_code=${code}&auto=1&referer=`
          } as any)
          if (html) {
            const pMatch = html.match(
              /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/
            )
            if (pMatch) {
              let p = pMatch[1]
              const a = parseInt(pMatch[2], 10)
              let c = parseInt(pMatch[3], 10)
              const k = pMatch[4].split('|')
              while (c--) {
                if (k[c]) p = p.replace(new RegExp('\\b' + c.toString(a) + '\\b', 'g'), k[c])
              }
              const m3u8 = p.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/)
              if (m3u8) {
                return {
                  url: m3u8[0],
                  type: 'hls',
                  headers: { Referer: 'https://uqload.vc/' }
                }
              }
            }
          }
        }
      }

      // 3. MP4Upload (.mp4)
      if (lower.includes('mp4upload')) {
        const html = await this.fetchHtml(cleanEmbedUrl, { headers: refHeader })
        if (html) {
          const mp4Match =
            html.match(/player\.src\(['"]([^'"]+)['"]\)/) ||
            html.match(/src:\s*['"]([^'"]+\.mp4[^'"]*)['"]/) ||
            html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/)
          if (mp4Match) {
            return {
              url: mp4Match[1],
              type: 'mp4',
              headers: { Referer: 'https://www.mp4upload.com/' }
            }
          }
        }
      }

      // 4. Sendvid (.mp4)
      if (lower.includes('sendvid')) {
        const cleanUrl = cleanEmbedUrl.replace(/\.html$/, '')
        const html = await this.fetchHtml(cleanUrl, { headers: refHeader })
        if (html) {
          const mp4Match =
            html.match(/(https?:\/\/videos\d*\.sendvid\.com\/[^"'\s]+\.mp4[^"'\s]*)/) ||
            html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/)
          if (mp4Match) {
            return { url: mp4Match[1], type: 'mp4' }
          }
        }
      }

      // 5. LuluStream (.m3u8)
      if (lower.includes('lulustream') || lower.includes('morencius')) {
        const html = await this.fetchHtml(cleanEmbedUrl, { headers: refHeader })
        if (html) {
          const m3u8Match =
            html.match(/sources\s*:\s*\[\{\s*file:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/) ||
            html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/)
          if (m3u8Match) {
            return { url: m3u8Match[1], type: 'hls' }
          }
        }
      }

      // 6. VOE (voe.sx / arianathankspecial)
      if (
        lower.includes('voe.sx') ||
        lower.includes('arianathankspecial') ||
        lower.includes('voe-network')
      ) {
        const html = await this.fetchHtml(cleanEmbedUrl, { headers: refHeader })
        if (html) {
          const redirectMatch = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/)
          if (redirectMatch) {
            return this.resolveDirectStream(redirectMatch[1])
          }
          const m3u8Match =
            html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/) ||
            html.match(/['"]hls['"]\s*:\s*['"]([^'"]+)['"]/)
          if (m3u8Match) {
            return { url: m3u8Match[1], type: 'hls', headers: { Referer: cleanEmbedUrl } }
          }
        }
      }

      // 7. Ok.ru (Odnoklassniki / VK Video) (.mp4 / .m3u8)
      if (lower.includes('ok.ru') || lower.includes('odnoklassniki')) {
        let okUrl = cleanEmbedUrl
        if (okUrl.startsWith('//')) okUrl = `https:${okUrl}`
        const html = await this.fetchHtml(okUrl, { headers: refHeader })
        if (html) {
          const dataOptions = html.match(/data-options=["']([^"']+)["']/i)
          if (dataOptions) {
            try {
              const unescaped = dataOptions[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')
              const parsed = JSON.parse(unescaped)
              const meta =
                typeof parsed.flashvars?.metadata === 'string'
                  ? JSON.parse(parsed.flashvars.metadata)
                  : parsed.flashvars?.metadata
              if (meta?.videos && Array.isArray(meta.videos) && meta.videos.length > 0) {
                const priority = ['ultra', 'quad', 'full', 'hd', 'sd', 'low', 'lowest', 'mobile']
                const sorted = [...meta.videos].sort((a, b) => {
                  const aIdx = priority.indexOf(a.name)
                  const bIdx = priority.indexOf(b.name)
                  return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx)
                })
                const bestVideo = sorted[0]
                if (bestVideo?.url) {
                  return {
                    url: bestVideo.url,
                    type: 'mp4',
                    headers: { Referer: 'https://ok.ru/' }
                  }
                }
              }
              if (meta?.hlsManifestUrl) {
                return {
                  url: meta.hlsManifestUrl,
                  type: 'hls',
                  headers: { Referer: 'https://ok.ru/' }
                }
              }
            } catch {}
          }
        }
      }
    } catch {}
    return null
  }

  public async resolveVidmolyStream(embedUrl: string): Promise<string | null> {
    const res = await this.resolveDirectStream(embedUrl)
    return res && res.type === 'hls' ? res.url : null
  }

  protected async fetchHtml(url: string, options: FetchOptions = {}): Promise<string> {
    if (!url) return ''

    const defaultHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      Referer: this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache'
    }

    try {
      const res = await fetch(url, {
        ...options,
        headers: { ...defaultHeaders, ...options.headers }
      } as any)

      if (!res.ok) {
        const errorDetail =
          res.status === 403
            ? `HTTP 403 Forbidden / Cloudflare challenge triggered on ${url}`
            : res.status === 429
              ? `HTTP 429 Rate limited on ${url}`
              : `HTTP ${res.status} ${res.statusText} for ${url}`
        if (!options.silent) console.warn(`[${this.name}] ${errorDetail}`)
        if (options.throwOnError) {
          throw new Error(errorDetail)
        }
        return ''
      }

      return await res.text()
    } catch (e: any) {
      if (!options.silent) console.warn(`[${this.name}] Fetch error for ${url}: ${e.message}`)
      if (options.throwOnError) throw e
      return ''
    }
  }

  abstract fetchPopular(page: number, extraArgs?: FetchOptions): Promise<MangaPage>
  abstract fetchLatest(page: number, extraArgs?: FetchOptions): Promise<MangaPage>
  abstract searchManga(query: string, page: number, extraArgs?: FetchOptions): Promise<MangaPage>
  abstract fetchMangaDetails(manga: Manga): Promise<Manga>
  abstract fetchChapters(mangaUrl: string): Promise<Chapter[]>
  abstract fetchPages(episodeUrl: string): Promise<string[] | StreamingServer[]>
}
