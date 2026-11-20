import { MangaDexSource } from '../src/extensions/manga/all/mangadex/index'
import { ShahiidAnimeSource } from '../src/extensions/anime/ar/shahiidanime/index'
import { RistoAnimeSource } from '../src/extensions/anime/ar/ristoanime/index'
import { MangaLek } from '../src/extensions/manga/ar/mangalek/index'
import { MangaSid } from '../src/extensions/manga/ar/mangasid/index'
import { MangaSwat } from '../src/extensions/manga/ar/mangaswat/index'
import { TeamX } from '../src/extensions/manga/ar/teamx/index'

interface TestResult {
  name: string
  pkg: string
  popularOk: boolean
  mangaCount: number
  detailsOk: boolean
  chaptersOk: boolean
  chapterCount: number
  durationMs: number
  error?: string
}

async function runHealthCheck() {
  console.log('====================================================')
  console.log('  AutaKimi Extensions Health Checker Routine')
  console.log('====================================================\n')

  const sourcesToTest: Array<{ name: string; instance: any }> = [
    { name: 'MangaDex', instance: new MangaDexSource() },
    { name: 'Shahiid Anime', instance: new ShahiidAnimeSource() },
    { name: 'Risto Anime', instance: new RistoAnimeSource() },
    { name: 'MangaLek', instance: new MangaLek() },
    { name: 'MangaSid', instance: new MangaSid() },
    { name: 'MangaSwat', instance: new MangaSwat() },
    { name: 'Team X', instance: new TeamX() }
  ]

  const results: TestResult[] = []

  for (const { name, instance } of sourcesToTest) {
    const startTime = Date.now()
    const pkg = instance.id || instance.pkg || name
    console.log(`[Testing Source] ${name} (${pkg})...`)

    let popularOk = false
    let mangaCount = 0
    let detailsOk = false
    let chaptersOk = false
    let chapterCount = 0
    let errorMsg: string | undefined

    try {
      // 1. Test fetchPopular
      const popRes = await instance.fetchPopular(1)
      if (popRes && Array.isArray(popRes.manga) && popRes.manga.length > 0) {
        popularOk = true
        mangaCount = popRes.manga.length
        const sample = popRes.manga[0]

        // 2. Test fetchMangaDetails
        try {
          const detailsRes = await instance.fetchMangaDetails(sample)
          if (detailsRes && (detailsRes.title || detailsRes.description !== undefined)) {
            detailsOk = true
          }
        } catch (e: any) {
          console.warn(`  - fetchMangaDetails error for ${name}:`, e.message)
        }

        // 3. Test fetchChapters
        try {
          const chaptersRes = await instance.fetchChapters(sample.url || sample.id)
          if (Array.isArray(chaptersRes)) {
            chaptersOk = true
            chapterCount = chaptersRes.length
          }
        } catch (e: any) {
          console.warn(`  - fetchChapters error for ${name}:`, e.message)
        }
      } else {
        errorMsg = 'fetchPopular returned 0 items'
      }
    } catch (e: any) {
      errorMsg = e.message || String(e)
      console.error(`  - Failed health check for ${name}:`, errorMsg)
    }

    const durationMs = Date.now() - startTime
    results.push({
      name,
      pkg,
      popularOk,
      mangaCount,
      detailsOk,
      chaptersOk,
      chapterCount,
      durationMs,
      error: errorMsg
    })
  }

  console.log('\n====================================================')
  console.log('                 HEALTH REPORT RESULTS              ')
  console.log('====================================================')
  console.table(
    results.map((r) => ({
      Source: r.name,
      Popular: r.popularOk ? `PASS (${r.mangaCount})` : 'FAIL',
      Details: r.detailsOk ? 'PASS' : 'FAIL',
      Chapters: r.chaptersOk ? `PASS (${r.chapterCount})` : 'FAIL',
      Time: `${r.durationMs}ms`,
      Error: r.error || 'None'
    }))
  )

  const passedCount = results.filter((r) => r.popularOk).length
  console.log(`\nSummary: ${passedCount}/${results.length} extensions passed core health checks.\n`)

  if (passedCount === 0) {
    process.exit(1)
  }
}

runHealthCheck().catch((e) => {
  console.error('Fatal health check runner error:', e)
  process.exit(1)
})
