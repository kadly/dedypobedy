import * as React from "react"
import "./src/styles.css"
import Layout from "./src/components/layout"

export const wrapRootElement = ({ element }) => {
  return <Layout>{element}</Layout>
}

export const onRouteUpdate = ({ location }) => {
  const savedPosition = sessionStorage.getItem('mainPageScrollPosition');
  // Restore scroll position if we're returning to the main page and have a saved position
  if (location.pathname === '/' && savedPosition) {
    setTimeout(() => {
      // The timeout gives the page time to render before scrolling
      window.scrollTo(0, parseInt(savedPosition, 10));
      sessionStorage.removeItem('mainPageScrollPosition');
    }, 100);
  }
};
