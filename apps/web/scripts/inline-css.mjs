import fs from 'node:fs'
import path from 'node:path'

const dist = path.resolve(process.cwd(), 'dist')
const indexPath = path.join(dist, 'index.html')

let html = fs.readFileSync(indexPath, 'utf8')
const linkPattern = /<link\s+rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/i
const match = html.match(linkPattern)

if (!match) {
  console.log('inline-css: nenhum link de CSS encontrado')
  process.exit(0)
}

const cssPath = path.join(dist, match[1].replace(/^\//, ''))
if (!fs.existsSync(cssPath)) {
  console.error('inline-css: arquivo CSS nao encontrado:', cssPath)
  process.exit(1)
}

const css = fs.readFileSync(cssPath, 'utf8')
html = html.replace(linkPattern, () => `<style>${css}</style>`)
fs.writeFileSync(indexPath, html, 'utf8')
console.log(`inline-css: ${css.length} bytes embutidos no index.html`)
