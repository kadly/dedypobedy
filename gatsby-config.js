/**
 * @type {import('gatsby').GatsbyConfig}
 */
module.exports = {
  siteMetadata: {
    title: `Деды победы`,
    description: `Сайт памяти фронтовиков`,
    siteUrl: `https://dedypobedy.ru`,
  },
  plugins: [
    `gatsby-plugin-image`,
    {
      resolve: `gatsby-plugin-sharp`,
      options: {
        maxConcurrency: 1,
      },
    },
    {
      resolve: `gatsby-transformer-sharp`,
      options: {
        defaults: {
          quality: 50,
          breakpoints: 750,
          placeholder: `blurred`,
        },
      },
    },
    `gatsby-transformer-json`,
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `dedy`,
        path: `${__dirname}/dedy/`,
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `data`,
        path: `${__dirname}/src/data/`,
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `heroStory`,
        path: `${__dirname}/heroStory/`,
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `medals`,
        path: `${__dirname}/medals/`,
      },
    },
  ],
}
