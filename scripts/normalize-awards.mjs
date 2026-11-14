// Приводит поле medals в veterans.json к каноническому виду:
// названия строго из src/data/awards.json, порядок — по старшинству,
// повторы — суффиксом (N).
//
//   node scripts/normalize-awards.mjs          — переписать файл
//   node scripts/normalize-awards.mjs --check  — только проверить (для CI)

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { formatMedals, findUnknownMedals } from "../src/utils/awards.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const veteransPath = path.join(root, "src/data/veterans.json")
const awards = JSON.parse(fs.readFileSync(path.join(root, "src/data/awards.json"), "utf8"))
const veterans = JSON.parse(fs.readFileSync(veteransPath, "utf8"))

const checkOnly = process.argv.includes("--check")
const problems = []
let changed = 0

const normalized = veterans.map(veteran => {
  if (typeof veteran.medals !== "string") return veteran

  const unknown = findUnknownMedals(veteran.medals, awards)
  if (unknown.length > 0) {
    problems.push(`${veteran.slug}: нет в справочнике — ${unknown.join(", ")}`)
    return veteran
  }

  const medals = formatMedals(veteran.medals, awards)
  if (medals !== veteran.medals) changed += 1
  return { ...veteran, medals }
})

if (problems.length > 0) {
  console.error("Неизвестные награды:\n" + problems.map(line => "  " + line).join("\n"))
  process.exit(1)
}

if (checkOnly) {
  if (changed > 0) {
    console.error(`medals не нормализованы: ${changed} карточек. Запустите node scripts/normalize-awards.mjs`)
    process.exit(1)
  }
  console.log(`medals в порядке: ${veterans.length} карточек`)
  process.exit(0)
}

if (changed === 0) {
  console.log("Изменений нет: medals уже нормализованы")
  process.exit(0)
}

fs.writeFileSync(veteransPath, JSON.stringify(normalized, null, 2) + "\n")
console.log(`Обновлено карточек: ${changed} из ${veterans.length}`)
