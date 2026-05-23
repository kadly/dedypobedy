import * as React from "react"

const Layout = ({ children }) => {
  return (
    <div className="layout-wrapper">
      <div className="content">
        {children}
      </div>
      <footer>
        <div className="container">
          <p>
            Идея и реализация: Д.П. Гутов. Информация на сайте может быть недостоверна. По всем вопросам обращайтесь в Telegram: <a href="https://t.me/gmitry" target="_blank" rel="noopener noreferrer">@gmitry</a>
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Layout