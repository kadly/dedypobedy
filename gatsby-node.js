const path = require("path")

exports.createSchemaCustomization = ({ actions }) => {
  actions.createTypes(`
    type VeteransJson implements Node {
      description: String
      seoTitle: String
      seoDescription: String
      documents: [VeteransDocument]
    }

    type VeteransDocument {
      title: String
      url: String
    }
  `)
}

exports.createPages = async ({ graphql, actions }) => {
  const { createPage } = actions
  const veteranTemplate = path.resolve(`src/templates/veteran.js`)

  const result = await graphql(`
    query {
      allVeteransJson {
        nodes {
          slug
          name
          photo
          heroStoryPhoto
          yearsOfLife
          birthPlace
          conscriptionDate
          rank
          unit
          medals
          heroStory
        }
      }
    }
  `)

  if (result.errors) {
    throw result.errors
  }

  const veterans = result.data.allVeteransJson.nodes
  const seen = new Set()

  veterans.forEach(veteran => {
    if (!veteran.slug || seen.has(veteran.slug)) return
    seen.add(veteran.slug)

    createPage({
      path: `/veteran/${veteran.slug}`,
      component: veteranTemplate,
      context: {
        slug: veteran.slug,
        photo: veteran.photo,
      },
    })
  })
}
