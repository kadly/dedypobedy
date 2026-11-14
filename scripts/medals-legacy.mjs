// Дословная копия старого сопоставления наград из src/templates/veteran.js
// (до перехода на справочник src/data/awards.json).
// Файл существует только как эталон для scripts/compare-medals.mjs:
// сайт его не импортирует. Не редактировать.

const medalMappings = [
  { pattern: /медаль\s*«за отвагу»/i, imagePattern: 'Medal_Za_Otvagu', displayName: 'Медаль «За отвагу»' },
  { pattern: /медаль\s*«за победу над японией»/i, imagePattern: 'Medal_Za_pobedu_nad_YAponiej', displayName: 'Медаль «За победу над Японией»' },
  { pattern: /медаль\s*«за взятие вены»/i, imagePattern: 'Medal_Za_vzyatie_Veny', displayName: 'Медаль «За взятие Вены»' },
  { pattern: /медаль\s*«за освобождение белграда»/i, imagePattern: 'Medal_Za_osvobozhdenie_Belgrada', displayName: 'Медаль «За освобождение Белграда»' },
  { pattern: /медаль\s*«за взятие будапешта»/i, imagePattern: 'Medal_Za_vzyatie_Budapeshta', displayName: 'Медаль «За взятие Будапешта»' },
  { pattern: /медаль\s*«за оборону сталинграда»/i, imagePattern: 'Medal_Za_oboronu_Stalingrada', displayName: 'Медаль «За оборону Сталинграда»' },
  { pattern: /медаль\s*«за взятие берлина»/i, imagePattern: 'Medal_Za_vzyatie_Berlina', displayName: 'Медаль «За взятие Берлина»' },
  { pattern: /медаль\s*«за взятие кён[иё]гсберга»/i, imagePattern: 'Medal_Za_vzyatie_Keniksberga', displayName: 'Медаль «За взятие Кёнигсберга»' },
  { pattern: /медаль\s*«за оборону москвы»/i, imagePattern: 'Medal_Za_oboronu_Moskvy', displayName: 'Медаль «За оборону Москвы»' },
  { pattern: /медаль\s*«за оборону кавказа»/i, imagePattern: 'Medal_Za_oboronu_Kavkaza', displayName: 'Медаль «За оборону Кавказа»' },
  { pattern: /медаль\s*«за оборону ленинграда»/i, imagePattern: 'Medal_Za_oboronu_Leningrada', displayName: 'Медаль «За оборону Ленинграда»' },
  { pattern: /медаль\s*«за победу над германией/i, imagePattern: 'Medal_Za_pobedu_nad_Germaniej', displayName: 'Медаль «За победу над Германией в Великой Отчественной войне 1941–1945 гг.»' },
  { pattern: /медаль\s*«за боевые заслуги»/i, imagePattern: 'Medal_Za_Boevye_zaslugi', displayName: 'Медаль «За боевые заслуги»' },
  { pattern: /медаль\s*«за освобождение праги»/i, imagePattern: 'Medal_Za_osvobozhdenie_Pragi', displayName: 'Медаль «За освобождение Праги»' },
  { pattern: /орден\s+славы\s+(1|ii)\s*степени?/i, imagePattern: 'Orden_Slavy_1st', displayName: 'Орден Славы 1-й степени' },
  { pattern: /орден\s+славы\s+(2|ii)(?!\d)\s*степени?/i, imagePattern: 'Orden_Slavy_2st', displayName: 'Орден Славы 2-й степени' },
  { pattern: /орден\s+славы\s+(3|iii)\s*степени?/i, imagePattern: 'Orden_Slavy_3st', displayName: 'Орден Славы 3-й степени' },
  { pattern: /орден\s+отечественной\s+войны\s+ii/i, imagePattern: 'Orden_Otechestvennoj_vojny_2st', displayName: 'Орден Отественной войны II степени' },
  { pattern: /орден\s+отечественной\s+войны\s+i/i, imagePattern: 'Orden_Otechestvennoj_vojny_1st', displayName: 'Орден Отественной войны I степени' },
  { pattern: /орден\s+красной\s+звезды/i, imagePattern: 'Orden_Krasnoj_Zvezdy', displayName: 'Орден Красной Звезды' },
  { pattern: /орден\s+красного\s+знамени/i, imagePattern: 'Orden_Krasnogo_Znameni', displayName: 'Орден Красного Знамени' }
]

// Повторяет getMedalImages() из старого veteran.js, но без GraphQL:
// возвращает плоский список имён файлов (повторы — отдельными элементами).
export const legacyMedalImages = medals => {
  if (!medals) return []

  const result = []

  const medalList = medals.split(';').map(m => m.trim()).filter(m => m)

  medalList.forEach(medalText => {
    for (const mapping of medalMappings) {
      if (mapping.pattern.test(medalText)) {
        const countMatch = medalText.match(/\((\d+)\)/)
        const count = countMatch ? parseInt(countMatch[1], 10) : 1

        for (let i = 0; i < count; i++) {
          result.push(mapping.imagePattern)
        }
        break
      }
    }
  })

  return result
}

export { medalMappings }
