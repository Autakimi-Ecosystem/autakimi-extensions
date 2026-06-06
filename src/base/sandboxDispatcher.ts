/**
 * Generic Sandbox Dispatcher
 * --------------------------
 * Wraps an ISourceAdapter class and executes its methods based on the `params`
 * injected by the AutaKimi WorkerVM sandbox environment.
 */

export async function executeExtension(source: any, params: any): Promise<any> {
  const page = Math.floor((params.offset || 0) / (params.limit || 30)) + 1
  
  if (params.type === 'fetchPages') {
    const pages = await source.fetchPages(params.chapterUrl)
    return { pages }
  }
  
  if (params.type === 'fetchChapters') {
    const chapters = await source.fetchChapters(params.mangaUrl)
    return { data: chapters }
  }
  
  if (params.type === 'fetchMangaDetails') {
    const details = await source.fetchMangaDetails({ url: params.mangaUrl, id: params.mangaUrl } as any)
    return { data: details }
  }
  
  if (params.activeFeed === 'search' && params.debouncedSearch) {
    const res = await source.searchManga(params.debouncedSearch, page)
    return { data: res.manga, hasNextPage: res.hasNextPage }
  }
  
  if (params.activeFeed === 'latest') {
    const res = await source.fetchLatest(page)
    return { data: res.manga, hasNextPage: res.hasNextPage }
  }
  
  // Default to popular feed
  const res = await source.fetchPopular(page)
  return { data: res.manga, hasNextPage: res.hasNextPage }
}
