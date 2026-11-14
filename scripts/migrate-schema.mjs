// Однократная миграция схемы veterans.json: добавляет поля, которые
// редактируются в админке, не меняя существующие значения.
//
//   node scripts/migrate-schema.mjs          — показать план
//   node scripts/migrate-schema.mjs --write  — применить

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const file = path.join(root, "src/data/veterans.json")
const veterans = JSON.parse(fs.readFileSync(file, "utf8"))

const defaults = {
  description: "",
  seoTitle: "",
  seoDescription: "",
  documents: []
}

let changed = 0

const migrated = veterans.map(veteran => {
  const next = { ...veteran }
  let touched = false

  Object.entries(defaults).forEach(([key, value]) => {
    if (!(key in next)) {
      next[key] = Array.isArray(value) ? [] : value
      touched = true
    }
  })

  if (touched) changed += 1
  return next
})

console.log(`Записей с новыми полями: ${changed} из ${veterans.length}`)

if (!process.argv.includes("--write")) {
  console.log("Это план. Примените: node scripts/migrate-schema.mjs --write")
  process.exit(0)
}

if (changed === 0) {
  console.log("Изменений нет")
  process.exit(0)
}

fs.writeFileSync(file, JSON.stringify(migrated, null, 2) + "\n")
console.log("Записано")
