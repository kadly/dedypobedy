import * as React from "react"
import { graphql, Link } from "gatsby"
import { GatsbyImage, getImage } from "gatsby-plugin-image"
import { resolveAwards } from "../utils/awards.mjs"

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

  // Награды: справочник src/data/awards.json + картинки из medals/.
  // Награды без картинки остаются только текстом.
  const awardList = data.allAwardsJson?.nodes || []
  const medalFiles = data.medalsFile?.nodes || []
  const displayedMedals = React.useMemo(() => {
    const filesByName = new Map(medalFiles.map(file => [file.name, file]))

    return resolveAwards(veteran.medals, awardList).flatMap(award => {
      if (!award.image) return []

      const fileName = award.image.replace(/\.(png|jpe?g|webp)$/i, "")
      const file = filesByName.get(fileName)
      const image = file ? getImage(file.childImageSharp) : null
      if (!image) return []

      return Array.from({ length: award.count }, () => ({
        img: image,
        name: award.title,
        originalUrl: file.publicURL
      }))
    })
  }, [veteran.medals, awardList, medalFiles])

  const medalTitles = (veteran.medals || "")
    .split(";")
    .map(part => part.trim())
    .filter(Boolean)

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
            
            {medalTitles.length > 0 && (
              <div className="info-row">
                <span className="label">Награды:</span>
                <span className="value">{medalTitles.map((part, i) => (
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
    allAwardsJson {
      nodes {
        title
        image
        group
        order
      }
    }
  }
`

export const Head = ({ data }) => (
  <title>{data.veteransJson.name} - Деды победы</title>
)

export default VeteranPage
