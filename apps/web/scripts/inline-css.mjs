import fs from 'node:fs'
import path from 'node:path'

const dist = path.resolve(process.cwd(), 'dist')
const indexPath = path.join(dist, 'index.html')

let html = fs.readFileSync(indexPath, 'utf8')

const cssPattern = /<link\s+rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/i
const cssMatch = html.match(cssPattern)
if (cssMatch) {
  const cssPath = path.join(dist, cssMatch[1].replace(/^\//, ''))
  if (!fs.existsSync(cssPath)) {
    console.error('inline-css: arquivo CSS nao encontrado:', cssPath)
    process.exit(1)
  }
  const css = fs.readFileSync(cssPath, 'utf8')
  html = html.replace(cssPattern, () => `<style>${css}</style>`)
  console.log(`inline: ${css.length} bytes de CSS`)
}

const jsPattern = /<script\s+type="module"[^>]*src="([^"]+\.js)"[^>]*><\/script>/i
const jsMatch = html.match(jsPattern)
if (jsMatch) {
  const jsPath = path.join(dist, jsMatch[1].replace(/^\//, ''))
  if (!fs.existsSync(jsPath)) {
    console.error('inline-css: arquivo JS nao encontrado:', jsPath)
    process.exit(1)
  }
  const raw = fs.readFileSync(jsPath, 'utf8')
  const js = raw.replace(/<\/script/gi, '<\\/script')
  html = html.replace(jsPattern, () => `<script type="module">${js}</script>`)
  console.log(`inline: ${raw.length} bytes de JS`)
}

fs.writeFileSync(indexPath, html, 'utf8')
console.log(`inline: index.html com ${html.length} bytes; assets externos: ${(html.match(/\/assets\//g) || []).length}`)
