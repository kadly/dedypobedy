// Проверка данных перед сборкой. Запускается в CI до gatsby build.
// Ошибки останавливают деплой, предупреждения только выводятся.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  findUnknownMedals,
  formatMedals,
  normalizeAwardTitle
} from "../src/utils/awards.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"))
const listDir = dir => {
  const full = path.join(root, dir)
  return fs.existsSync(full) ? fs.readdirSync(full) : []
}

const errors = []
const warnings = []
const error = message => errors.push(message)
const warn = message => warnings.push(message)

const awards = readJson("src/data/awards.json")
const veterans = readJson("src/data/veterans.json")

if (!Array.isArray(awards)) error("awards.json: ожидался массив")
if (!Array.isArray(veterans)) error("veterans.json: ожидался массив")
if (errors.length > 0) {
  console.error(errors.join("\n"))
  process.exit(1)
}

// ---------- справочник наград ----------

const medalFiles = new Set(listDir("medals"))
const awardTitles = new Set()
const awardOrders = new Set()

awards.forEach((award, index) => {
  const label = `awards.json[${index}]`
  if (!award.title) error(`${label}: пустой title`)
  if (award.title) {
    const key = normalizeAwardTitle(award.title)
    if (awardTitles.has(key)) error(`${label}: дубль награды «${award.title}»`)
    awardTitles.add(key)
  }
  if (!Number.isInteger(award.order)) {
    error(`${label}: order должен быть числом`)
  } else if (awardOrders.has(award.order)) {
    error(`${label}: order ${award.order} уже занят`)
  } else {
    awardOrders.add(award.order)
  }
  if (!["orden", "medal", "other"].includes(award.group)) {
    error(`${label}: неизвестная группа «${award.group}»`)
  }
  if (award.image && !medalFiles.has(award.image)) {
    error(`${label}: нет файла medals/${award.image}`)
  }
})

// ---------- карточки ----------

const photoFiles = new Set(listDir("dedy"))
const scanFiles = new Set(
  listDir("heroStory").map(file => file.replace(/\.(jpe?g|png|webp)$/i, ""))
)

const slugs = new Set()
const names = new Set()

veterans.forEach((veteran, index) => {
  const label = veteran.slug || `veterans.json[${index}]`

  if (!veteran.slug) {
    error(`${label}: пустой slug`)
  } else if (!/^[a-z0-9-]+$/.test(veteran.slug)) {
    error(`${label}: slug должен состоять из a-z, 0-9 и дефисов`)
  } else if (slugs.has(veteran.slug)) {
    error(`${label}: дубль slug — страница перезапишет другую`)
  } else {
    slugs.add(veteran.slug)
  }

  if (!veteran.name || !String(veteran.name).trim()) {
    error(`${label}: пустое ФИО`)
  } else {
    const key = String(veteran.name).trim().toLowerCase()
    if (names.has(key)) warn(`${label}: повторяющееся ФИО «${veteran.name}»`)
    names.add(key)
  }

  const medals = veteran.medals || ""
  if (medals) {
    const unknown = findUnknownMedals(medals, awards)
    if (unknown.length > 0) {
      error(`${label}: награды нет в справочнике — ${unknown.join(", ")}`)
    } else if (formatMedals(medals, awards) !== medals) {
      error(`${label}: medals не в каноническом виде (порядок/названия). Запустите scripts/normalize-awards.mjs`)
    }
  }

  const description = String(veteran.description || "")
  if (/<\s*script/i.test(description)) {
    error(`${label}: в описании есть <script>`)
  }
  if (/\son[a-z]+\s*=/i.test(description)) {
    error(`${label}: в описании есть inline-обработчик события`)
  }
  if (/javascript:/i.test(description)) {
    error(`${label}: в описании есть javascript:`)
  }

  if (veteran.seoTitle && String(veteran.seoTitle).length > 70) {
    warn(`${label}: SEO Title длиннее 70 символов`)
  }
  if (veteran.seoDescription && String(veteran.seoDescription).length > 200) {
    warn(`${label}: SEO Description длиннее 200 символов`)
  }

  const years = String(veteran.yearsOfLife || "").trim()
  if (years && !/^(\d{3,4}|\?)?(\s*—\s*(\d{3,4}|\?)?)?$/.test(years)) {
    warn(`${label}: нестандартные годы жизни «${years}»`)
  }

  if (veteran.photo && !photoFiles.has(veteran.photo)) {
    warn(`${label}: нет файла dedy/${veteran.photo}`)
  }

  if (veteran.heroStoryPhoto) {
    const pinned = String(veteran.heroStoryPhoto).replace(/\.(jpe?g|png|webp)$/i, "")
    if (!scanFiles.has(pinned)) {
      warn(`${label}: нет скана heroStory/${veteran.heroStoryPhoto}`)
    }
  }

  const documents = veteran.documents || []
  if (!Array.isArray(documents)) {
    error(`${label}: documents должен быть массивом`)
  } else {
    const urls = new Set()
    documents.forEach((document, docIndex) => {
      const docLabel = `${label}: documents[${docIndex}]`
      if (!document || typeof document !== "object") {
        error(`${docLabel}: ожидался объект { title, url }`)
        return
      }
      if (!document.title || !String(document.title).trim()) {
        warn(`${docLabel}: пустое название документа`)
      }
      if (!document.url || !String(document.url).startsWith("/docs/")) {
        error(`${docLabel}: url должен начинаться с /docs/`)
        return
      }
      if (urls.has(document.url)) {
        error(`${docLabel}: дубль ссылки ${document.url}`)
      }
      urls.add(document.url)

      const filePath = path.join(root, "static", document.url.replace(/^\//, ""))
      if (!fs.existsSync(filePath)) {
        error(`${docLabel}: нет файла static${document.url}`)
      }
    })
  }

  if (veteran.heroStory && !veteran.heroStoryPhoto) {
    // не ошибка: сканы находятся по префиксу slug
  }
})

// ---------- итог ----------

const uniqueWarnings = [...new Set(warnings)]

if (uniqueWarnings.length > 0) {
  console.warn(`Предупреждения: ${uniqueWarnings.length}`)
  uniqueWarnings.slice(0, 30).forEach(message => console.warn(`  ! ${message}`))
  if (uniqueWarnings.length > 30) {
    console.warn(`  … и ещё ${uniqueWarnings.length - 30}`)
  }
}

if (errors.length > 0) {
  console.error(`\nОшибки: ${errors.length}`)
  errors.forEach(message => console.error(`  x ${message}`))
  process.exit(1)
}

console.log(
  `Данные в порядке: ${veterans.length} карточек, ${awards.length} наград, ` +
    `${uniqueWarnings.length} предупреждений`
)
