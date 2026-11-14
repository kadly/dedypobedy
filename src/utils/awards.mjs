// Справочник наград живёт в src/data/awards.json.
// Здесь только чистые функции: нормализация названий, разбор строки medals
// и сопоставление с справочником. Никаких зашитых названий наград.

export const normalizeAwardTitle = value =>
  String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()

// "Медаль «За отвагу» (2); Орден Красной Звезды" ->
// [{ title: "Медаль «За отвагу»", count: 2 }, { title: "Орден Красной Звезды", count: 1 }]
export const parseMedals = medals => {
  if (!medals) return []

  return String(medals)
    .split(";")
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const counted = part.match(/^(.*?)\s*\((\d+)\)$/)
      if (counted) {
        return { title: counted[1].trim(), count: Math.max(1, parseInt(counted[2], 10)) }
      }
      return { title: part, count: 1 }
    })
}

// Сопоставляет награды ветерана со справочником и сортирует по старшинству.
// Возвращает только известные справочнику награды:
// [{ title, image, group, order, count }]
export const resolveAwards = (medals, awards) => {
  const dictionary = new Map(
    (awards || []).map(award => [normalizeAwardTitle(award.title), award])
  )

  return parseMedals(medals)
    .map(entry => {
      const award = dictionary.get(normalizeAwardTitle(entry.title))
      return award ? { ...award, count: entry.count } : null
    })
    .filter(Boolean)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

// Каноническая строка для хранения в veterans.json — в порядке старшинства.
export const formatMedals = (medals, awards) =>
  resolveAwards(medals, awards)
    .map(({ title, count }) => (count > 1 ? `${title} (${count})` : title))
    .join("; ")

// Награды, которых нет в справочнике (для валидатора и админки).
export const findUnknownMedals = (medals, awards) => {
  const known = new Set((awards || []).map(award => normalizeAwardTitle(award.title)))
  return parseMedals(medals)
    .filter(entry => !known.has(normalizeAwardTitle(entry.title)))
    .map(entry => entry.title)
}
