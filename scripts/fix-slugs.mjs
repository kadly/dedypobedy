// Однократное исправление slug: 11 записей делили адрес с другими людьми,
// из-за чего их страницы перезаписывались и не существовали на сайте.
// Адрес остаётся у той записи, которой он соответствует; остальные получают
// slug из своего ФИО. Список составлен вручную по результатам сверки.
//
//   node scripts/fix-slugs.mjs          — показать план
//   node scripts/fix-slugs.mjs --write  — применить

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const file = path.join(root, "src/data/veterans.json")
const veterans = JSON.parse(fs.readFileSync(file, "utf8"))

// index — позиция в файле, name — контроль, что данные не сдвинулись.
const renames = [
  { index: 6, name: "Айтпаев Николай Иванович", to: "aytpaev-nikolay-ivanovich" },
  { index: 25, name: "Бугай Михаил Иванович", to: "bugay-mikhail-ivanovich" },
  { index: 50, name: "Галушко Иван Петрович", to: "galushko-ivan-petrovich" },
  { index: 83, name: "Заковряжин Михаил Александрович", to: "zakovryazhin-mikhail-aleksandrovich" },
  { index: 137, name: "Кондрашов Ефим Макарович", to: "kondrashov-efim-makarovich" },
  { index: 246, name: "Полянский Василий Иванович", to: "polyansky-vasiliy-ivanovich" },
  { index: 252, name: "Попов Павел Емельянович", to: "popov-pavel-emelianovich-2" },
  { index: 277, name: "Романков Андрей Маркович", to: "romankov-andrey-markovich" },
  { index: 285, name: "Саенко Лукьян Игнатьевич", to: "saenko-lukyan-ignatovich" },
  { index: 288, name: "Сажко Фёдор Игнатьевич", to: "sazhko-fedor-ignatovich" },
  { index: 293, name: "Самойлов Иван Яковлевич", to: "samoylov-ivan-yakovlevich" },
  { index: 78, name: "Жакьянов Мажить", to: "zhakyanov-mazhit" }
]

renames.forEach(({ index, name }) => {
  if (veterans[index].name !== name) {
    throw new Error(`Запись ${index} не совпадает: ожидалось «${name}», найдено «${veterans[index].name}»`)
  }
})

const finalSlugs = veterans.map((veteran, index) => {
  const rename = renames.find(item => item.index === index)
  return rename ? rename.to : veteran.slug
})

const used = new Set()
finalSlugs.forEach(slug => {
  if (used.has(slug)) {
    throw new Error(`Остался дубль slug: ${slug}`)
  }
  used.add(slug)
})

renames.forEach(({ index, to }) => {
  console.log(`${veterans[index].name}\n  ${veterans[index].slug} -> ${to}`)
})
console.log(`\nВсего изменений: ${renames.length}`)

if (!process.argv.includes("--write")) {
  console.log("Это план. Примените: node scripts/fix-slugs.mjs --write")
  process.exit(0)
}

renames.forEach(({ index, to }) => {
  veterans[index].slug = to
})

fs.writeFileSync(file, JSON.stringify(veterans, null, 2) + "\n")
console.log("Записано")
