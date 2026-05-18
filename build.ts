import * as fs from 'fs'
import * as path from 'path'

const EXTENSIONS_DIR = __dirname
const SRC_DIR = path.join(EXTENSIONS_DIR, 'src')
const TEMPLATES_SRC_DIR = path.join(SRC_DIR, 'templates')
const PLUGINS_SRC_DIR = path.join(SRC_DIR, 'plugins')

function buildTemplates() {
  console.log('Building templates...')
  const templatesFile = path.join(EXTENSIONS_DIR, 'templates.json')
  
  // Read version dynamically from package.json
  const pkgPath = path.join(EXTENSIONS_DIR, 'package.json')
  const pkgVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || '1.0.0'
  
  // Read existing templates.json to keep version and metadata intact
  let existingData: { version: string; templates: any[] } = { version: pkgVersion, templates: [] }
  if (fs.existsSync(templatesFile)) {
    try {
      existingData = JSON.parse(fs.readFileSync(templatesFile, 'utf8'))
      existingData.version = pkgVersion
    } catch (e) {
      console.warn('Failed to parse existing templates.json, creating new.')
    }
  }

  const templateFiles = fs.readdirSync(TEMPLATES_SRC_DIR)
    .filter(f => f.endsWith('.ts') || f.endsWith('.js'))

  const builtTemplates: any[] = []

  for (const file of templateFiles) {
    const filePath = path.join(TEMPLATES_SRC_DIR, file)
    const id = path.parse(file).name
    const fileContent = fs.readFileSync(filePath, 'utf8')

    // Statically extract the return statement containing the backtick template code
    const startIdx = fileContent.indexOf('return `')
    const endIdx = fileContent.lastIndexOf('`')

    if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
      console.error(`[Error] Template ${id} does not have a valid "return \`...\`" statement. skipping.`)
      continue
    }

    const generatorCode = fileContent.slice(startIdx, endIdx + 1).trim()
    
    // Find existing metadata or use default
    const existing = existingData.templates.find(t => t.id === id)
    const name = existing ? existing.name : id.charAt(0).toUpperCase() + id.slice(1)

    builtTemplates.push({
      id,
      name,
      generator: generatorCode
    })
    console.log(`  - Built template: ${id}`)
  }

  existingData.templates = builtTemplates
  fs.writeFileSync(templatesFile, JSON.stringify(existingData, null, 2) + '\n', 'utf8')
  console.log(`Successfully wrote templates.json with ${builtTemplates.length} templates.`)
}

function buildPlugins() {
  console.log('Building plugins...')
  const pluginsFile = path.join(EXTENSIONS_DIR, 'plugins.json')

  // Read version dynamically from package.json
  const pkgPath = path.join(EXTENSIONS_DIR, 'package.json')
  const pkgVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || '1.0.0'

  // Read existing plugins.json to keep metadata intact
  let existingData: { version: string; plugins: any[] } = { version: pkgVersion, plugins: [] }
  if (fs.existsSync(pluginsFile)) {
    try {
      existingData = JSON.parse(fs.readFileSync(pluginsFile, 'utf8'))
      existingData.version = pkgVersion
    } catch (e) {
      console.warn('Failed to parse existing plugins.json, creating new.')
    }
  }

  const pluginFiles = fs.readdirSync(PLUGINS_SRC_DIR)
    .filter(f => f.endsWith('.ts') || f.endsWith('.js'))

  const builtPlugins: any[] = []

  for (const file of pluginFiles) {
    const filePath = path.join(PLUGINS_SRC_DIR, file)
    const id = path.parse(file).name
    const fileContent = fs.readFileSync(filePath, 'utf8')

    // Statically extract the function body inside the outer braces
    const firstBrace = fileContent.indexOf('{')
    const lastBrace = fileContent.lastIndexOf('}')

    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      console.error(`[Error] Plugin ${id} does not have a valid function body. skipping.`)
      continue
    }

    const body = fileContent.slice(firstBrace + 1, lastBrace).trim()
    const pluginCode = `return async (context) => {\n${body}\n}`

    // Find existing metadata or use defaults
    const existing = existingData.plugins.find(p => p.id === id)
    
    builtPlugins.push({
      id,
      name: existing ? existing.name : id.charAt(0).toUpperCase() + id.slice(1),
      description: existing ? existing.description : '',
      author: existing ? existing.author : 'AutaKimi Community',
      version: existing ? existing.version : '1.0.0',
      target: existing ? existing.target : 'main-cloudflare',
      code: pluginCode
    })
    console.log(`  - Built plugin: ${id}`)
  }

  existingData.plugins = builtPlugins
  fs.writeFileSync(pluginsFile, JSON.stringify(existingData, null, 2) + '\n', 'utf8')
  console.log(`Successfully wrote plugins.json with ${builtPlugins.length} plugins.`)
}

try {
  buildTemplates()
  buildPlugins()
  console.log('Build pipeline completed successfully.')
} catch (e: any) {
  console.error('Build execution failed:', e.message)
  process.exit(1)
}
