import * as React from "react"
import { graphql, Link } from "gatsby"
import { GatsbyImage, getImage } from "gatsby-plugin-image"

const IndexPage = ({ data }) => {
  const veterans = data.allVeteransJson.nodes
  const files = data.allFile.nodes
  const webpFiles = data.allWebpFile?.nodes || []
  const groupPhoto = data.groupPhoto ? getImage(data.groupPhoto) : null
  const [searchTerm, setSearchTerm] = React.useState('')
  const [activeTab, setActiveTab] = React.useState('alive') // 'alive' or 'fallen'

  // Save scroll position before navigating to veteran page
  const handleVeteranClick = () => {
    sessionStorage.setItem('mainPageScrollPosition', window.scrollY.toString());
  };

  // Create a map of filename to image
  const fileMap = {}
  files.forEach(file => {
    fileMap[file.name] = file
  })

  // Create a map for webp images
  const webpMap = {}
  webpFiles.forEach(file => {
    webpMap[file.name] = file
  })

  // Filter veterans by tab and search term
  const filteredVeterans = veterans.filter(veteran => {
    const matchesSearch = veteran.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTab = activeTab === 'fallen'
      ? veteran.toBeKilled === 'true'
      : veteran.toBeKilled !== 'true'
    return matchesSearch && matchesTab
  })

  // Debug: show counts
  console.log('Total veterans:', veterans.length, '| Filtered:', filteredVeterans.length, '| Tab:', activeTab)

  return (
    <main>
      <header className="main-header">
        <div className="container">
          <h1>Деды Победы</h1>
          <p className="subtitle">Сайт памяти фронтовиков</p>
          <p className="stats">Предположительно, на войну ушли 616 уроженцев Травного</p>
          <p className="stats">295 вернулись, а 321 — нет</p>
        </div>
      </header>

      {groupPhoto && (
        <div className="group-photo-container">
          <GatsbyImage
            image={groupPhoto}
            alt="Групповое фото фронтовиков"
            className="group-photo"
          />
        </div>
      )}

      <div className="container">
        <div className="search-and-tabs">
          <input
            type="text"
            placeholder="Поиск по имени..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-input"
            autofocus="autofocus"
          />

          {/* Tabs */}
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'alive' ? 'active' : ''}`}
              onClick={() => setActiveTab('alive')}
            >
              Вернулись живыми
            </button>
            <button
              className={`tab ${activeTab === 'fallen' ? 'active' : ''}`}
              onClick={() => setActiveTab('fallen')}
            >
              Погибли
            </button>
          </div>
        </div>

        <div className="cards-grid">
          {filteredVeterans.map((veteran, index) => {
            // Get filename without extension
            const photoName = veteran.photo.replace(/\.(jpg|jpeg|png|webp)$/i, '')
            const file = fileMap[photoName]
            const webpFile = webpMap[photoName]
            const image = file ? getImage(file.childImageSharp) : null

            return (
              <Link
                to={`/veteran/${veteran.slug}`}
                key={index}
                className="card"
                onClick={handleVeteranClick}
              >
                {image ? (
                  <GatsbyImage
                    image={image}
                    alt={veteran.name}
                    className="card-image"
                  />
                ) : webpFile ? (
                  <img
                    src={webpFile.publicURL}
                    alt={veteran.name}
                    className="card-image"
                  />
                ) : (
                  <div className="card-placeholder">
                    Нет изображения
                  </div>
                )}
                <div className="card-content">
                  <h2 className="card-name">{veteran.name}</h2>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}

export const query = graphql`
  query {
    allVeteransJson {
      nodes {
        slug
        name
        photo
        toBeKilled
      }
    }
    allFile(filter: {sourceInstanceName: {eq: "dedy"}, extension: {regex: "/(jpg|jpeg|png)/"}}) {
      nodes {
        name
        childImageSharp {
          gatsbyImageData(width: 300, height: 500, layout: CONSTRAINED, placeholder: NONE)
        }
      }
    }
    allWebpFile: allFile(filter: {sourceInstanceName: {eq: "dedy"}, extension: {eq: "webp"}}) {
      nodes {
        name
        publicURL
      }
    }
    groupPhoto: file(name: {eq: "Group"}, sourceInstanceName: {eq: "dedy"}, relativeDirectory: {eq: "photo"}) {
      childImageSharp {
        gatsbyImageData(width: 1200, height: 800, placeholder: NONE)
      }
    }
  }
`

export const Head = () => <title>Деды Победы</title>

export default IndexPage
