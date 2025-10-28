import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const projectRoot = path.resolve(__dirname, '..')
const srcDir = path.join(projectRoot, 'src')

const printer = ts.createPrinter({ removeComments: true })

function listFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...listFiles(full))
    } else {
      out.push(full)
    }
  }
  return out
}

function isTsFile(file) {
  const ext = path.extname(file)
  if (ext !== '.ts') return false
  // ignore declaration files
  if (file.endsWith('.d.ts')) return false
  return true
}

function stripCommentsTs(filePath) {
  const original = fs.readFileSync(filePath, 'utf8')
  const source = ts.createSourceFile(
    filePath,
    original,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    ts.ScriptKind.TS,
  )
  const printed = printer.printFile(source)
  if (printed !== original) {
    fs.writeFileSync(filePath, printed, 'utf8')
    return true
  }
  return false
}

function main() {
  if (!fs.existsSync(srcDir)) {
    console.error('src directory not found:', srcDir)
    process.exit(1)
  }
  const files = listFiles(srcDir).filter(isTsFile)
  let changed = 0
  for (const f of files) {
    const did = stripCommentsTs(f)
    if (did) changed++
  }
  console.log(`Processed ${files.length} TS files; modified ${changed}.`)
}

main()