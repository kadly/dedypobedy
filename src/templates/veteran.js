import * as React from "react"
import { graphql, Link } from "gatsby"
import { GatsbyImage, getImage } from "gatsby-plugin-image"

const VeteranPage = ({ data }) => {
  const veteran = data.veteransJson
  const allVeterans = data.allVeteransJson?.nodes || []
  const [showModal, setShowModal] = React.useState(false)
  const [selectedMedal, setSelectedMedal] = React.useState(null)
  const [currentHeroIndex, setCurrentHeroIndex] = React.useState(0)

  // Deduplicate by slug
  const uniqueVeterans = React.useMemo(() => {
    const seen = new Set()
    return allVeterans.filter(v => {
      if (!v || !v.slug || seen.has(v.slug)) return false
      seen.add(v.slug)
      return true
    })
  }, [allVeterans])

  // Find current index and prev/next
  const currentIndex = uniqueVeterans.findIndex(v => v && v.slug === veteran?.slug)
  const prevVeteran = currentIndex > 0 ? uniqueVeterans[currentIndex - 1] : null
  const nextVeteran = currentIndex >= 0 && currentIndex < uniqueVeterans.length - 1 ? uniqueVeterans[currentIndex + 1] : null
  
  // Get filename without extension for veteran photo
  const photoName = veteran.photo.replace(/\.(jpg|jpeg|png|webp)$/i, '')
  const file = data.allFile.nodes.find(f => f.name === photoName)
  const webpFile = data.webpFile?.nodes.find(f => f.name === photoName)
  const image = file ? getImage(file.childImageSharp) : null

  // Get hero story photos - support both single string and array, plus backward compatibility
  const heroFiles = data.heroStoryFile?.nodes || []
  
  // Find hero images by matching files that start with the veteran's slug
  const heroImages = heroFiles
    .filter(f => f.name.startsWith(veteran.slug))
    .map(f => ({
      gatsbyImage: getImage(f.childImageSharp),
      publicURL: f.publicURL,
      name: f.name
    }))

  // Show link if there are hero images
  const hasDocumentsLink = heroImages.length > 0

  // Get all medal images from the medals folder
  const medalImages = data.medalsFile?.nodes || []
  
  // Parse medals and display images
  const getMedalImages = () => {
    if (!veteran.medals || medalImages.length === 0) return []

    const result = []

    // Define medal mappings: text pattern -> image name pattern -> display name
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

    // Split medals by semicolon and process each one
    const medalList = veteran.medals.split(';').map(m => m.trim()).filter(m => m)

    medalList.forEach(medalText => {
      for (const mapping of medalMappings) {
        if (mapping.pattern.test(medalText)) {
          const medalImg = medalImages.find(f => f.name === mapping.imagePattern)
          if (medalImg) {
            // Check for count in parentheses
            const countMatch = medalText.match(/\((\d+)\)/)
            const count = countMatch ? parseInt(countMatch[1]) : 1

            for (let i = 0; i < count; i++) {
              result.push({
                img: getImage(medalImg.childImageSharp),
                name: mapping.displayName,
                originalUrl: medalImg.publicURL
              })
            }
          }
          break // Found match, move to next medal
        }
      }
    })

    return result
  }
  
  const displayedMedals = getMedalImages()
  const isDeceased = veteran.toBeKilled === "true"

  return (
    <main className="veteran-page">
      <header>
        <div className="container">
          <div className="header-nav">
            {prevVeteran && (
              <Link to={`/veteran/${prevVeteran.slug}`} className="nav-button prev-button" title={prevVeteran.name}>
                ‹ ‹
              </Link>
            )}
            <Link to="/" className="back-link">← Назад к списку</Link>
            {nextVeteran && (
              <Link to={`/veteran/${nextVeteran.slug}`} className="nav-button next-button" title={nextVeteran.name}>
                › ›
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="container">
        <div className={`veteran-card${isDeceased ? " deceased" : ""}`}>
          <div className={`veteran-photo${veteran.toBeKilled === "true" ? " toBeKilled" : ""}`}>
            {image ? (
              <GatsbyImage
                image={image}
                alt={veteran.name}
                className="photo"
              />
            ) : webpFile ? (
              <img
                src={webpFile.publicURL}
                alt={veteran.name}
                className="photo"
              />
            ) : (
              <div className="photo-placeholder">Нет фото</div>
            )}
          </div>
          
          <div className="veteran-info">
            <h1 className="veteran-name">{veteran.name}</h1>
            {isDeceased && <div className="deceased-label">Не вернулся с войны</div>}
            
            {veteran.yearsOfLife && (
              <div className="info-row">
                <span className="label">Годы жизни:</span>
                <span className="value">{veteran.yearsOfLife}</span>
              </div>
            )}
            
            {veteran.birthPlace && (
              <div className="info-row">
                <span className="label">Место рождения:</span>
                <span className="value">{veteran.birthPlace}</span>
              </div>
            )}
            
            {veteran.conscriptionDate && (
              <div className="info-row">
                <span className="label">Год призыва:</span>
                <span className="value">{veteran.conscriptionDate}</span>
              </div>
            )}
            
            {veteran.rank && (
              <div className="info-row">
                <span className="label">Воинское звание:</span>
                <span className="value">{veteran.rank}</span>
              </div>
            )}

            {veteran.position && (
              <div className="info-row">
                <span className="label">Должность:</span>
                <span className="value">{veteran.position.split("; ").map((part, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <br />}
                    {part}
                  </React.Fragment>
                ))}</span>
              </div>
            )}

            {veteran.unit && (
              <div className="info-row">
                <span className="label">Воинская часть:</span>
                <span className="value">{veteran.unit.split("; ").map((part, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <br />}
                    {part}
                  </React.Fragment>
                ))}</span>
              </div>
            )}
            
            {veteran.medals && (
              <div className="info-row">
                <span className="label">Награды:</span>
                <span className="value">{veteran.medals.split("; ").map((part, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <br />}
                    {part}
                  </React.Fragment>
                ))}</span>
                
                {/* Medal images - inside medals field */}
                {displayedMedals.length > 0 && (
                  <div className="medals-gallery">
                    {displayedMedals.map((medal, idx) => (
                      medal.img && (
                        <div 
                          key={idx} 
                          className="medal-item"
                          onClick={() => setSelectedMedal(medal)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && setSelectedMedal(medal)}
                        >
                          <GatsbyImage 
                            image={medal.img} 
                            alt={medal.name}
                            className="medal-image"
                            objectFit="contain"
                          />
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Medal Modal */}
            {selectedMedal && (
              <div className="modal-overlay" onClick={() => setSelectedMedal(null)}>
                <div className="modal-content medal-modal" onClick={(e) => e.stopPropagation()}>
                  <button className="modal-close" onClick={() => setSelectedMedal(null)}>×</button>
                  {selectedMedal.img && (
                    <GatsbyImage 
                      image={selectedMedal.img} 
                      alt={selectedMedal.name}
                      className="medal-full-image"
                      objectFit="contain"
                    />
                  )}
                  <p className="medal-caption">{selectedMedal.name}</p>
                </div>
              </div>
            )}
            
            {hasDocumentsLink && heroImages.length > 0 && (
              <div className="info-row">
                <span className="label">Документы о награждении:</span>
                <span 
                  className="documents-link"
                  onClick={() => { setCurrentHeroIndex(0); setShowModal(true); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setCurrentHeroIndex(0); setShowModal(true); } }}
                >
                  Посмотреть документы
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <span className="modal-close" onClick={() => setShowModal(false)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setShowModal(false)}>×</span>
            
            {heroImages.length > 1 && (
              <>
                <div className="modal-counter">{currentHeroIndex + 1} / {heroImages.length}</div>
                <div className="modal-navigation">
                  <button onClick={() => setCurrentHeroIndex((currentHeroIndex - 1 + heroImages.length) % heroImages.length)}>‹</button>
                  <button onClick={() => setCurrentHeroIndex((currentHeroIndex + 1) % heroImages.length)}>›</button>
                </div>
              </>
            )}
            {heroImages.length > 0 && (
              <img
                src={heroImages[currentHeroIndex].publicURL}
                alt={`Документ ${currentHeroIndex + 1}`}
                className="hero-document"
              />
            )}
          </div>
        </div>
      )}
    </main>
  )
}

export const query = graphql`
  query($slug: String!) {
    allVeteransJson(sort: { slug: ASC }) {
      nodes {
        slug
        name
      }
    }
    veteransJson(slug: { eq: $slug }) {
      slug
      name
      photo
      heroStoryPhoto
      yearsOfLife
      birthPlace
      conscriptionDate
      rank
      position
      unit
      medals
      heroStory
      toBeKilled
    }
    allFile(filter: {sourceInstanceName: {eq: "dedy"}, extension: {regex: "/(jpg|jpeg|png)/"}}) {
      nodes {
        name
        childImageSharp {
          gatsbyImageData(width: 600, placeholder: BLURRED)
        }
      }
    }
    webpFile: allFile(filter: {sourceInstanceName: {eq: "dedy"}, extension: {eq: "webp"}}) {
      nodes {
        name
        publicURL
      }
    }
    heroStoryFile: allFile(filter: {sourceInstanceName: {eq: "heroStory"}, extension: {regex: "/(jpg|jpeg|png)/"}}) {
      nodes {
        name
        publicURL
        childImageSharp {
          gatsbyImageData(width: 800, placeholder: BLURRED)
        }
      }
    }
    medalsFile: allFile(filter: {sourceInstanceName: {eq: "medals"}, extension: {regex: "/(png|jpg|jpeg)/"}}) {
      nodes {
        name
        publicURL
        childImageSharp {
          gatsbyImageData(height: 300, placeholder: BLURRED, layout: CONSTRAINED)
        }
      }
    }
  }
`

export const Head = ({ data }) => (
  <title>{data.veteransJson.name} - Деды победы</title>
)

export default VeteranPage
