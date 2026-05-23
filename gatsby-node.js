const path = require("path")

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
  console.log('Gatsby-node: Total veterans from GraphQL:', veterans.length)

  veterans.forEach(veteran => {
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
