// Сравнивает старый regex-маппинг наград (scripts/medals-legacy.mjs)
// с новым справочником (src/data/awards.json) на всех записях veterans.json.
//
//   node scripts/compare-medals.mjs            — проверка, exit code 1 при расхождениях
//   node scripts/compare-medals.mjs --dump x.json — сохранить эталон старого поведения
//
// Порядок иконок сравнивается отдельно: новый порядок — по старшинству,
// поэтому перестановки выводятся как информация, а не как ошибка.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { legacyMedalImages } from "./medals-legacy.mjs"
import { resolveAwards } from "../src/utils/awards.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"))

const veterans = readJson("src/data/veterans.json")
const awards = readJson("src/data/awards.json")
const medalFiles = new Set(
  fs
    .readdirSync(path.join(root, "medals"))
    .map(file => file.replace(/\.(png|jpe?g|webp)$/i, ""))
)

const expandNew = medals =>
  resolveAwards(medals, awards).flatMap(award => {
    if (!award.image) return []
    const name = award.image.replace(/\.(png|jpe?g|webp)$/i, "")
    return Array.from({ length: award.count }, () => name)
  })

const dumpIndex = process.argv.indexOf("--dump")
if (dumpIndex !== -1) {
  const target = process.argv[dumpIndex + 1]
  if (!target) {
    console.error("Укажите файл: --dump medals-before.json")
    process.exit(1)
  }
  const snapshot = Object.fromEntries(
    veterans.map(veteran => [veteran.slug, legacyMedalImages(veteran.medals || "")])
  )
  fs.writeFileSync(path.resolve(root, target), JSON.stringify(snapshot, null, 2) + "\n")
  console.log(`Эталон сохранён: ${target}`)
  process.exit(0)
}

// Известные баги старого regex, которые новый справочник исправляет.
// «Орден Славы II степени» старый код распознавал как I степень
// (шаблон (1|ii) стоял раньше (2|ii)), а файла Orden_Slavy_1st.png нет,
// поэтому иконка не показывалась совсем. Теперь — правильная II степень.
const knownFixes = {
  "prikhodin-andrey-mironovich": {
    legacy: "Orden_Slavy_1st",
    current: "Orden_Slavy_2st"
  }
}

const sorted = list => [...list].sort()
const sameSet = (a, b) => {
  if (a.length !== b.length) return false
  const left = sorted(a)
  const right = sorted(b)
  return left.every((value, index) => value === right[index])
}

const errors = []
const orderChanges = []
const fixed = []
const missingFiles = new Set()

veterans.forEach(veteran => {
  const slug = veteran.slug
  const medals = veteran.medals || ""
  const legacy = legacyMedalImages(medals)
  const current = expandNew(medals)

  current.forEach(name => {
    if (!medalFiles.has(name)) missingFiles.add(name)
  })

  if (!sameSet(legacy, current)) {
    const fix = knownFixes[slug]
    const isKnownFix =
      fix &&
      legacy.includes(fix.legacy) &&
      current.includes(fix.current) &&
      sameSet(
        legacy.filter(name => name !== fix.legacy),
        current.filter(name => name !== fix.current)
      )

    if (isKnownFix) {
      fixed.push({ slug, name: veteran.name, from: fix.legacy, to: fix.current })
    } else {
      errors.push({ slug, name: veteran.name, legacy, current })
    }
    return
  }

  if (legacy.join("|") !== current.join("|")) {
    orderChanges.push({ slug, name: veteran.name, legacy, current })
  }
})

if (missingFiles.size > 0) {
  console.error("Нет файлов в medals/: " + [...missingFiles].join(", "))
}

if (errors.length > 0) {
  console.error(`\nРасхождения: ${errors.length}\n`)
  errors.forEach(({ slug, name, legacy, current }) => {
    console.error(`${name} (${slug})`)
    console.error(`  было: ${legacy.join(", ") || "—"}`)
    console.error(`  стало: ${current.join(", ") || "—"}`)
  })
  process.exit(1)
}

console.log(`Проверено карточек: ${veterans.length}`)
console.log("Расхождений по составу иконок нет.")

if (fixed.length > 0) {
  console.log(`\nИсправлены старые ошибки сопоставления: ${fixed.length}`)
  fixed.forEach(({ name, from, to }) => {
    console.log(`  ${name}: ${from} -> ${to}`)
  })
}

if (orderChanges.length > 0) {
  console.log(`\nПорядок изменится у ${orderChanges.length} карточек (это ожидаемо: сортировка по старшинству).`)
  if (process.argv.includes("--verbose-order")) {
    orderChanges.forEach(({ name, legacy, current }) => {
      console.log(`  ${name}: ${legacy.join(", ")} -> ${current.join(", ")}`)
    })
  } else {
    console.log("  Подробный список: --verbose-order")
  }
}

if (missingFiles.size > 0) process.exit(1)
