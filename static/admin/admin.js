/* Админка «Деды Победы».
   Статическая страница: данные читаются и пишутся напрямую в GitHub
   через REST API (Contents + Git Data), без сервера.
   Токен хранится только в localStorage этого браузера. */

(() => {
  "use strict"

  const REPO = "kadly/dedypobedy"
  const BRANCH = "main"
  const VETERANS_PATH = "src/data/veterans.json"
  const AWARDS_PATH = "src/data/awards.json"
  const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`
  const TOKEN_KEY = "dp_admin_token"
  const CACHE_KEY = "dp_admin_cache_v1"
  const DRAFT_PREFIX = "dp_draft_"
  const PHOTO_DIR = "dedy"
  const DOCS_DIR = "static/docs"
  const DEFAULT_BIRTH_PLACE = "с. Травное Доволенского района Новосибирской области"

  const $ = selector => document.querySelector(selector)
  const $$ = selector => Array.from(document.querySelectorAll(selector))

  const state = {
    token: localStorage.getItem(TOKEN_KEY) || "",
    veterans: [],
    awards: [],
    sha: null,
    search: "",
    editing: null,
    originalSlug: null,
    isNew: false,
    dirty: false,
    filling: false,
    selectedAwards: [],
    documents: [],
    pendingPhoto: null,
    removePhoto: false,
    quill: null,
    loading: false
  }

  let draftTimer = null
  let toastTimer = null

  // ---------- утилиты ----------

  const esc = value =>
    String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")

  const plural = (n, one, few, many) => {
    const m10 = n % 10
    const m100 = n % 100
    if (m10 === 1 && m100 !== 11) return one
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few
    return many
  }

  const fmtDate = iso =>
    new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })

  const debounce = (fn, ms) => (...args) => {
    clearTimeout(draftTimer)
    draftTimer = setTimeout(() => fn(...args), ms)
  }

  const toast = (message, kind = "") => {
    const node = $("#toast")
    node.textContent = message
    node.className = `toast ${kind}`
    node.hidden = false
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      node.hidden = true
    }, 4200)
  }

  const setProgress = visible => {
    state.loading = visible
    $("#progress").hidden = !visible
  }

  const bytesToBase64 = bytes => {
    let binary = ""
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
    }
    return btoa(binary)
  }

  const utf8ToBase64 = value => bytesToBase64(new TextEncoder().encode(value))
  const base64ToUtf8 = value =>
    new TextDecoder().decode(
      Uint8Array.from(atob(String(value).replace(/\s/g, "")), char => char.charCodeAt(0))
    )

  async function blobToBase64(blob) {
    return bytesToBase64(new Uint8Array(await blob.arrayBuffer()))
  }

  const sanitizeHtml = html => (window.DOMPurify ? DOMPurify.sanitize(html) : html)

  const safeFileName = name =>
    String(name)
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "document.pdf"

  // ---------- GitHub API ----------

  async function api(path, options = {}) {
    const response = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    })

    if (!response.ok) {
      let detail = ""
      try {
        const body = await response.json()
        if (body && body.message) detail = `: ${body.message}`
      } catch (error) {
        /* тело не JSON */
      }
      const error = new Error(`${response.status} ${response.statusText}${detail}`)
      error.status = response.status
      throw error
    }

    const text = await response.text()
    return text ? JSON.parse(text) : null
  }

  async function fetchJsonFile(path) {
    const file = await api(`/repos/${REPO}/contents/${path}?ref=${BRANCH}`)
    let text = ""
    if (file.content) {
      text = base64ToUtf8(file.content)
    } else if (file.download_url) {
      const response = await fetch(file.download_url)
      text = await response.text()
    } else {
      throw new Error(`Не удалось прочитать ${path}`)
    }
    return { text, sha: file.sha }
  }

  function readCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null")
      if (cached && Array.isArray(cached.veterans)) return cached
    } catch (error) {
      /* испорченный кэш */
    }
    return null
  }

  function writeCache() {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ veterans: state.veterans, awards: state.awards, ts: Date.now() })
      )
    } catch (error) {
      /* переполнение хранилища не критично */
    }
  }

  async function loadAll() {
    setProgress(true)
    $("#sync-status").textContent = "Загрузка…"
    try {
      const [veteransFile, awardsFile] = await Promise.all([
        fetchJsonFile(VETERANS_PATH),
        fetchJsonFile(AWARDS_PATH)
      ])
      state.veterans = JSON.parse(veteransFile.text)
      state.awards = JSON.parse(awardsFile.text)
      state.sha = veteransFile.sha
      writeCache()
      renderList()
      $("#sync-status").textContent = `Обновлено ${new Date().toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit"
      })}`
    } finally {
      setProgress(false)
    }
  }

  // ---------- награды ----------

  const normalizeTitle = value =>
    String(value || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[«»"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim()

  function parseAwardString(value) {
    if (!value) return []
    return String(value)
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

  function awardByTitle(title) {
    const key = normalizeTitle(title)
    return state.awards.find(award => normalizeTitle(award.title) === key) || null
  }

  function serializeAwards() {
    return [...state.selectedAwards]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(award => (award.count > 1 ? `${award.title} (${award.count})` : award.title))
      .join("; ")
  }

  function setAwardsFromString(value) {
    state.selectedAwards = parseAwardString(value)
      .map(entry => {
        const award = awardByTitle(entry.title)
        return award ? { ...award, count: entry.count } : null
      })
      .filter(Boolean)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
  }

  function renderAwards() {
    const container = $("#awards")
    container.innerHTML = ""

    if (state.selectedAwards.length === 0) {
      container.innerHTML = '<div class="awards-empty">Награды не выбраны</div>'
      return
    }

    state.selectedAwards.forEach(award => {
      const row = document.createElement("div")
      row.className = "award-row"

      if (award.image) {
        const image = document.createElement("img")
        image.className = "award-thumb"
        image.alt = award.title
        image.loading = "lazy"
        image.src = `${RAW_BASE}/medals/${encodeURIComponent(award.image)}`
        row.appendChild(image)
      } else {
        const placeholder = document.createElement("div")
        placeholder.className = "award-thumb award-thumb-empty"
        placeholder.textContent = "нет фото"
        row.appendChild(placeholder)
      }

      const title = document.createElement("div")
      title.className = "award-title"
      title.textContent = award.title
      row.appendChild(title)

      const counter = document.createElement("div")
      counter.className = "award-count"
      const minus = document.createElement("button")
      minus.type = "button"
      minus.textContent = "−"
      const output = document.createElement("output")
      output.textContent = award.count
      const plus = document.createElement("button")
      plus.type = "button"
      plus.textContent = "+"
      counter.append(minus, output, plus)

      minus.addEventListener("click", () => {
        award.count = Math.max(1, award.count - 1)
        output.textContent = award.count
        markDirty()
      })
      plus.addEventListener("click", () => {
        award.count = Math.min(99, award.count + 1)
        output.textContent = award.count
        markDirty()
      })

      const remove = document.createElement("button")
      remove.type = "button"
      remove.className = "award-remove"
      remove.title = "Убрать награду"
      remove.textContent = "×"
      remove.addEventListener("click", () => {
        state.selectedAwards = state.selectedAwards.filter(item => item.title !== award.title)
        renderAwards()
        markDirty()
      })

      row.append(counter, remove)
      container.appendChild(row)
    })
  }

  function buildAwardSelect() {
    const select = $("#awards-select")
    select.innerHTML = '<option value="">Добавить награду…</option>'

    const groups = [
      ["orden", "Ордена"],
      ["medal", "Медали"],
      ["other", "Прочие награды"]
    ]

    groups.forEach(([key, label]) => {
      const awards = state.awards.filter(award => award.group === key)
      if (awards.length === 0) return

      const group = document.createElement("optgroup")
      group.label = label
      awards.forEach(award => {
        const option = document.createElement("option")
        option.value = award.title
        option.textContent = award.title
        group.appendChild(option)
      })
      select.appendChild(group)
    })

    select.onchange = () => {
      const title = select.value
      select.value = ""
      if (!title) return

      const existing = state.selectedAwards.find(
        award => normalizeTitle(award.title) === normalizeTitle(title)
      )
      if (existing) {
        existing.count += 1
      } else {
        const award = awardByTitle(title)
        if (award) state.selectedAwards.push({ ...award, count: 1 })
      }
      renderAwards()
      markDirty()
    }
  }

  // ---------- список ----------

  function renderList() {
    const query = state.search.trim().toLowerCase()
    const items = state.veterans
      .filter(veteran => !query || String(veteran.name).toLowerCase().includes(query))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "ru"))

    const total = state.veterans.length
    $("#list-title").textContent = `Деды Победы: ${total} ${plural(
      total,
      "человек",
      "человека",
      "человек"
    )}`

    const list = $("#list")
    list.innerHTML = ""

    if (items.length === 0) {
      list.innerHTML = '<div class="list-empty">Ничего не найдено</div>'
      return
    }

    items.forEach(veteran => {
      const button = document.createElement("button")
      button.type = "button"
      button.className =
        "list-item" + (veteran.slug === state.originalSlug ? " active" : "")

      const name = document.createElement("div")
      name.className = "list-name"
      name.textContent = veteran.name || "(без имени)"
      button.appendChild(name)

      const meta = document.createElement("div")
      meta.className = "list-meta"
      const parts = []
      if (veteran.yearsOfLife) parts.push(veteran.yearsOfLife)
      if (veteran.toBeKilled === "true") parts.push("не вернулся")
      if (veteran.photo) parts.push("фото")
      if ((veteran.documents || []).length > 0) parts.push("PDF")
      meta.textContent = parts.join(" · ") || "нет данных"
      button.appendChild(meta)

      button.addEventListener("click", () => openEditor(veteran.slug))
      list.appendChild(button)
    })
  }

  // ---------- редактор ----------

  function blankVeteran() {
    return {
      slug: "",
      name: "",
      photo: "",
      heroStoryPhoto: "",
      yearsOfLife: "",
      birthPlace: DEFAULT_BIRTH_PLACE,
      conscriptionDate: "",
      rank: "",
      position: "",
      unit: "",
      medals: "",
      heroStory: "Документы о награждении",
      description: "",
      seoTitle: "",
      seoDescription: "",
      documents: []
    }
  }

  function splitYears(value) {
    const parts = String(value || "").split(/\s*[—–]\s*/)
    if (parts.length >= 2) {
      return [parts[0].trim(), parts.slice(1).join(" — ").trim()]
    }
    return [String(value || "").trim(), ""]
  }

  function uniqueValues(field) {
    const values = new Set()
    state.veterans.forEach(veteran => {
      const value = String(veteran[field] || "").trim()
      if (value) values.add(value)
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b, "ru"))
  }

  function fillSelect(select, values, current, pinFirst) {
    select.innerHTML = ""
    const list = values.filter(value => value !== pinFirst)
    if (pinFirst) {
      const option = document.createElement("option")
      option.value = pinFirst
      option.textContent = pinFirst
      select.appendChild(option)
    }
    list.forEach(value => {
      const option = document.createElement("option")
      option.value = value
      option.textContent = value
      select.appendChild(option)
    })
    if (current && !values.includes(current)) {
      const option = document.createElement("option")
      option.value = current
      option.textContent = current
      select.appendChild(option)
    }
    const custom = document.createElement("option")
    custom.value = "__new__"
    custom.textContent = "＋ Добавить новое…"
    select.appendChild(custom)
    select.value = current || pinFirst || ""
  }

  function buildSelectField(selectId, inputId, values, current, pinFirst) {
    const select = $(selectId)
    const input = $(inputId)

    fillSelect(select, values, current, pinFirst)
    input.hidden = true
    input.value = ""

    select.onchange = () => {
      if (select.value === "__new__") {
        input.hidden = false
        input.focus()
      } else {
        input.hidden = true
        input.value = ""
      }
      markDirty()
    }
  }

  function currentSelectValue(selectId, inputId, pinnedFallback) {
    const select = $(selectId)
    const input = $(inputId)
    if (select.value === "__new__") return input.value.trim()
    return select.value || pinnedFallback || ""
  }

  function slugify(name) {
    const map = {
      а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
      и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
      с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
      щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya"
    }
    return String(name)
      .toLowerCase()
      .split("")
      .map(char => (map[char] !== undefined ? map[char] : char))
      .join("")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  }

  function uniqueSlug(base, ignoreSlug) {
    const taken = new Set(
      state.veterans.filter(v => v.slug !== ignoreSlug).map(v => v.slug)
    )
    let slug = base || "veteran"
    let suffix = 2
    while (taken.has(slug)) {
      slug = `${base}-${suffix}`
      suffix += 1
    }
    return slug
  }

  function setQuillContent(html) {
    if (!state.quill) return
    state.quill.setText("")
    if (html) {
      state.quill.clipboard.dangerouslyPasteHTML(sanitizeHtml(html))
    }
  }

  function photoUrl(name) {
    return name ? `${RAW_BASE}/dedy/${encodeURIComponent(name)}` : ""
  }

  function renderPhotoPreview() {
    const box = $("#photo-preview")
    box.innerHTML = ""

    if (state.pendingPhoto && state.pendingPhoto.previewUrl) {
      const image = document.createElement("img")
      image.src = state.pendingPhoto.previewUrl
      image.alt = "Новое фото"
      box.appendChild(image)
      return
    }

    if (state.editing && state.editing.photo && !state.removePhoto) {
      const image = document.createElement("img")
      image.src = photoUrl(state.editing.photo)
      image.alt = "Фото"
      image.onerror = () => {
        box.textContent = "Нет фото"
      }
      box.appendChild(image)
      return
    }

    box.textContent = "Нет фото"
  }

  function renderDocuments() {
    const container = $("#docs")
    container.innerHTML = ""

    if (state.documents.length === 0) {
      container.innerHTML = '<div class="hint">PDF не добавлены</div>'
      return
    }

    state.documents.forEach((doc, index) => {
      const row = document.createElement("div")
      row.className = "doc-row"

      const title = document.createElement("input")
      title.type = "text"
      title.value = doc.title || ""
      title.placeholder = "Название документа"
      title.addEventListener("input", () => {
        doc.title = title.value
        markDirty()
      })
      row.appendChild(title)

      if (doc.url) {
        const link = document.createElement("a")
        link.href = doc.url
        link.target = "_blank"
        link.rel = "noopener noreferrer"
        link.textContent = "открыть"
        row.appendChild(link)
      } else {
        const pending = document.createElement("span")
        pending.className = "hint"
        pending.textContent = doc.file ? doc.file.name : ""
        row.appendChild(pending)
      }

      const remove = document.createElement("button")
      remove.type = "button"
      remove.title = "Убрать документ"
      remove.textContent = "×"
      remove.addEventListener("click", () => {
        state.documents.splice(index, 1)
        renderDocuments()
        markDirty()
      })
      row.appendChild(remove)

      container.appendChild(row)
    })
  }

  function fillForm(record) {
    state.filling = true

    $("#f-name").value = record.name || ""

    const [born, died] = splitYears(record.yearsOfLife)
    $("#f-born").value = born
    $("#f-died").value = died

    $("#f-returned").checked = record.toBeKilled !== "true"

    buildSelectField(
      "#f-birth-place",
      "#f-birth-place-new",
      uniqueValues("birthPlace"),
      record.birthPlace || DEFAULT_BIRTH_PLACE,
      DEFAULT_BIRTH_PLACE
    )
    buildSelectField(
      "#f-rank",
      "#f-rank-new",
      uniqueValues("rank"),
      record.rank || "",
      ""
    )

    $("#f-conscription").value = record.conscriptionDate || ""
    $("#f-position").value = record.position || ""
    $("#f-unit").value = record.unit || ""
    $("#f-seo-title").value = record.seoTitle || ""
    $("#f-seo-description").value = record.seoDescription || ""

    $("#f-slug").value = record.slug || ""
    $("#slug-hint").textContent = state.isNew
      ? "Адрес создаётся из ФИО автоматически."
      : "Адрес страницы менять нельзя: он уже опубликован."

    setAwardsFromString(record.medals)
    renderAwards()

    setQuillContent(record.description || "")

    state.documents = (record.documents || []).map(doc => ({ ...doc }))
    renderDocuments()

    state.pendingPhoto = null
    state.removePhoto = false
    renderPhotoPreview()

    $("#f-photo").value = ""
    $("#f-doc").value = ""

    state.filling = false
  }

  function updateEditorHeader() {
    const name = $("#f-name").value.trim()
    $("#editor-title").textContent = name || "Новая карточка"
    const parts = []
    if (state.isNew) parts.push("новая запись")
    if (state.originalSlug) parts.push(state.originalSlug)
    $("#editor-subtitle").textContent = parts.join(" · ")
  }

  function openEditor(slug) {
    if (state.dirty && !confirm("Есть несохранённые изменения. Открыть другую карточку?")) {
      return
    }

    if (slug === null) {
      state.isNew = true
      state.originalSlug = null
      state.editing = blankVeteran()
    } else {
      const record = state.veterans.find(v => v.slug === slug)
      if (!record) return
      state.isNew = false
      state.originalSlug = slug
      state.editing = JSON.parse(JSON.stringify(record))
    }

    state.dirty = false
    $("#empty-state").hidden = true
    $("#editor-form").hidden = false
    $("#delete-btn").hidden = state.isNew
    $("#editor-form").scrollIntoView({ block: "start" })

    fillForm(state.editing)
    updateEditorHeader()
    renderList()
    updateDraftBanner()
    $("#save-status").textContent = ""
  }

  function markDirty() {
    if (state.filling) return
    state.dirty = true
    $("#save-status").textContent = "Есть несохранённые изменения"
    scheduleDraft()
  }

  // ---------- черновики ----------

  const draftKey = () => `${DRAFT_PREFIX}${state.originalSlug || "new"}`

  const scheduleDraft = debounce(() => {
    if (state.filling || !state.editing) return
    try {
      localStorage.setItem(
        draftKey(),
        JSON.stringify({ record: collect({ forDraft: true }), ts: Date.now() })
      )
    } catch (error) {
      /* не критично */
    }
  }, 600)

  function readDraft() {
    try {
      return JSON.parse(localStorage.getItem(draftKey()) || "null")
    } catch (error) {
      return null
    }
  }

  function updateDraftBanner() {
    const draft = readDraft()
    $("#draft-banner").hidden = !draft
  }

  function clearDraft() {
    localStorage.removeItem(draftKey())
    $("#draft-banner").hidden = true
  }

  // ---------- сбор данных формы ----------

  function currentName() {
    return $("#f-name").value.trim()
  }

  function ensureSlug() {
    const field = $("#f-slug")
    if (!state.isNew) return state.originalSlug
    const base = slugify(field.value.trim() || currentName())
    const slug = uniqueSlug(base, state.originalSlug)
    field.value = slug
    return slug
  }

  function collect(options = {}) {
    const record = state.editing ? { ...state.editing } : blankVeteran()

    record.name = currentName()

    const slug = options.forDraft
      ? $("#f-slug").value.trim() || slugify(record.name)
      : ensureSlug()
    record.slug = slug

    const born = $("#f-born").value.trim()
    const died = $("#f-died").value.trim()
    record.yearsOfLife = born && died ? `${born} — ${died}` : born || died || ""

    if ($("#f-returned").checked) {
      delete record.toBeKilled
    } else {
      record.toBeKilled = "true"
    }

    record.birthPlace = currentSelectValue("#f-birth-place", "#f-birth-place-new", DEFAULT_BIRTH_PLACE)
    record.rank = currentSelectValue("#f-rank", "#f-rank-new", "")
    record.conscriptionDate = $("#f-conscription").value.trim()
    record.position = $("#f-position").value.trim()
    record.unit = $("#f-unit").value.trim()
    record.seoTitle = $("#f-seo-title").value.trim()
    record.seoDescription = $("#f-seo-description").value.trim()

    if (state.quill) {
      const html = state.quill.root.innerHTML
      record.description = /^<p>(<br>)?<\/p>$/.test(html) ? "" : sanitizeHtml(html)
    }

    record.medals = serializeAwards()

    if (!options.forDraft) {
      record.photo = state.pendingPhoto
        ? state.pendingPhoto.fileName
        : state.removePhoto
        ? ""
        : record.photo || ""

      record.documents = state.documents
        .filter(doc => doc.url)
        .map(doc => ({ title: doc.title || "Документ", url: doc.url }))
    }

    return record
  }

  // ---------- сохранение ----------

  async function commitFiles(files, message) {
    const ref = await api(`/repos/${REPO}/git/ref/heads/${BRANCH}`)
    const headSha = ref.object.sha
    const headCommit = await api(`/repos/${REPO}/git/commits/${headSha}`)

    const tree = []
    for (const file of files) {
      const blob = await api(`/repos/${REPO}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: file.base64, encoding: "base64" })
      })
      tree.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha })
    }

    const newTree = await api(`/repos/${REPO}/git/trees`, {
      method: "POST",
      body: JSON.stringify({ base_tree: headCommit.tree.sha, tree })
    })

    const commit = await api(`/repos/${REPO}/git/commits`, {
      method: "POST",
      body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] })
    })

    await api(`/repos/${REPO}/git/refs/heads/${BRANCH}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false })
    })

    return commit.sha
  }

  async function convertPhoto(file) {
    try {
      const bitmap = await createImageBitmap(file)
      const maxSize = 1600
      const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.86))
      if (blob) return { blob, extension: "webp" }
    } catch (error) {
      /* конвертация недоступна — сохраним оригинал */
    }

    const extension = (file.name.split(".").pop() || "jpg").toLowerCase()
    return { blob: file, extension }
  }

  async function save() {
    if (state.loading) return

    const name = currentName()
    if (!name) {
      toast("Укажите ФИО", "error")
      $("#f-name").focus()
      return
    }

    const record = collect()
    if (!record.slug) {
      toast("Не удалось создать адрес страницы", "error")
      return
    }

    const files = []

    try {
      setProgress(true)

      if (state.pendingPhoto) {
        const photo = state.pendingPhoto
        const fileName = `${record.slug}.${photo.extension}`
        files.push({
          path: `${PHOTO_DIR}/${fileName}`,
          base64: await blobToBase64(photo.blob)
        })
        record.photo = fileName
      }

      for (const doc of state.documents) {
        if (!doc.file) continue
        const fileName = safeFileName(doc.file.name).replace(/\.pdf$/i, "") + ".pdf"
        const path = `${DOCS_DIR}/${record.slug}/${fileName}`
        files.push({ path, base64: await blobToBase64(doc.file) })
        record.documents = record.documents || []
        record.documents.push({
          title: doc.title || doc.file.name.replace(/\.pdf$/i, ""),
          url: `/${path.replace(/^static\//, "")}`
        })
      }

      const index = state.veterans.findIndex(v => v.slug === state.originalSlug)
      if (state.isNew) {
        state.veterans.push(record)
      } else if (index >= 0) {
        state.veterans[index] = record
      } else {
        throw new Error("Карточка не найдена в данных — обновите страницу")
      }

      files.push({
        path: VETERANS_PATH,
        base64: utf8ToBase64(JSON.stringify(state.veterans, null, 2) + "\n")
      })

      const message = state.isNew
        ? `admin: добавлена карточка ${record.name}`
        : `admin: изменена карточка ${record.name}`

      const sha = await commitFiles(files, message)

      state.originalSlug = record.slug
      state.isNew = false
      state.editing = JSON.parse(JSON.stringify(record))
      state.dirty = false
      state.pendingPhoto = null
      state.removePhoto = false
      clearDraft()

      await loadAll()
      renderList()
      fillForm(record)
      updateEditorHeader()
      $("#delete-btn").hidden = false
      $("#save-status").textContent = `Сохранено ${new Date().toLocaleTimeString("ru-RU")}`
      toast(`Сохранено. Коммит ${sha.slice(0, 7)}. Сборка сайта займёт 5–7 минут.`, "ok")
    } catch (error) {
      toast(`Не сохранено: ${error.message}`, "error")
      if (error.status === 401 || error.status === 403) {
        showAuth("Токен не имеет доступа к репозиторию (Contents: Read and write).")
      }
    } finally {
      setProgress(false)
    }
  }

  async function removeVeteran() {
    if (!state.originalSlug) return
    const record = state.veterans.find(v => v.slug === state.originalSlug)
    if (!record) return

    if (
      !confirm(
        `Удалить карточку «${record.name}»?\n\nЗапись исчезнет с сайта после сборки. Восстановить можно через историю git.`
      )
    ) {
      return
    }

    try {
      setProgress(true)
      state.veterans = state.veterans.filter(v => v.slug !== state.originalSlug)

      const sha = await commitFiles(
        [
          {
            path: VETERANS_PATH,
            base64: utf8ToBase64(JSON.stringify(state.veterans, null, 2) + "\n")
          }
        ],
        `admin: удалена карточка ${record.name}`
      )

      clearDraft()
      state.dirty = false
      state.originalSlug = null
      state.editing = null
      $("#editor-form").hidden = true
      $("#empty-state").hidden = false
      renderList()
      await loadAll()
      toast(`Удалено. Коммит ${sha.slice(0, 7)}. Восстановление — через историю git.`, "ok")
    } catch (error) {
      toast(`Не удалено: ${error.message}`, "error")
    } finally {
      setProgress(false)
    }
  }

  // ---------- история ----------

  async function showHistory() {
    $("#modal-title").textContent = "История изменений"
    $("#modal-body").innerHTML = '<p class="muted">Загрузка…</p>'
    $("#modal").hidden = false

    try {
      const commits = await api(
        `/repos/${REPO}/commits?path=${encodeURIComponent(VETERANS_PATH)}&per_page=25`
      )
      const body = $("#modal-body")
      body.innerHTML = ""

      commits.forEach(commit => {
        const item = document.createElement("div")
        item.className = "commit"

        const message = document.createElement("div")
        message.className = "commit-msg"
        message.textContent = commit.commit.message.split("\n")[0]
        item.appendChild(message)

        const meta = document.createElement("div")
        meta.className = "commit-meta"
        const link = document.createElement("a")
        link.href = commit.html_url
        link.target = "_blank"
        link.rel = "noopener noreferrer"
        link.textContent = commit.sha.slice(0, 7)
        meta.append(
          `${fmtDate(commit.commit.author.date)} · ${commit.commit.author.name} · `,
          link
        )
        item.appendChild(meta)
        body.appendChild(item)
      })
    } catch (error) {
      $("#modal-body").innerHTML = `<p class="error">${esc(error.message)}</p>`
    }
  }

  // ---------- авторизация ----------

  function showAuth(message) {
    $("#app-view").hidden = true
    $("#auth-view").hidden = false
    $("#history-btn").hidden = true
    $("#logout-btn").hidden = true
    if (message) {
      $("#auth-error").textContent = message
      $("#auth-error").hidden = false
    }
  }

  function showApp() {
    $("#auth-view").hidden = true
    $("#app-view").hidden = false
    $("#history-btn").hidden = false
    $("#logout-btn").hidden = false
  }

  async function connect(token) {
    state.token = token.trim()
    if (!state.token) {
      $("#auth-error").textContent = "Введите токен"
      $("#auth-error").hidden = false
      return
    }

    $("#auth-error").hidden = true
    setProgress(true)

    try {
      await loadAll()
      localStorage.setItem(TOKEN_KEY, state.token)
      showApp()
      renderList()
      buildAwardSelect()
      toast("Подключено", "ok")
    } catch (error) {
      state.token = ""
      showAuth(`Не удалось подключиться: ${error.message}`)
    } finally {
      setProgress(false)
    }
  }

  // ---------- инициализация ----------

  function bindEvents() {
    $("#token-save").addEventListener("click", () => connect($("#token-input").value))
    $("#token-input").addEventListener("keydown", event => {
      if (event.key === "Enter") connect($("#token-input").value)
    })

    $("#logout-btn").addEventListener("click", () => {
      if (!confirm("Отключиться и удалить токен из браузера?")) return
      localStorage.removeItem(TOKEN_KEY)
      state.token = ""
      location.reload()
    })

    $("#history-btn").addEventListener("click", showHistory)
    $("#modal-close").addEventListener("click", () => {
      $("#modal").hidden = true
    })
    $("#modal").addEventListener("click", event => {
      if (event.target === $("#modal")) $("#modal").hidden = true
    })

    $("#search-input").addEventListener("input", event => {
      state.search = event.target.value
      renderList()
    })

    $("#add-btn").addEventListener("click", () => openEditor(null))
    $("#reload-btn").addEventListener("click", async () => {
      try {
        await loadAll()
        toast("Данные обновлены", "ok")
      } catch (error) {
        toast(error.message, "error")
      }
    })

    $("#editor-form").addEventListener("submit", event => {
      event.preventDefault()
      save()
    })
    $("#delete-btn").addEventListener("click", removeVeteran)

    $("#cancel-btn").addEventListener("click", () => {
      if (state.dirty && !confirm("Отменить несохранённые изменения?")) return
      openEditor(state.originalSlug)
    })

    $("#draft-restore").addEventListener("click", () => {
      const draft = readDraft()
      if (!draft || !draft.record) return
      state.editing = draft.record
      fillForm(draft.record)
      markDirty()
      $("#draft-banner").hidden = true
      toast("Черновик восстановлен")
    })

    $("#draft-discard").addEventListener("click", () => {
      clearDraft()
    })

    $("#f-name").addEventListener("input", () => {
      if (state.isNew) {
        const field = $("#f-slug")
        const previousAuto = slugify(field.dataset.auto || "")
        if (!field.value || field.value === previousAuto) {
          field.value = slugify(currentName())
          field.dataset.auto = field.value
        }
      }
      updateEditorHeader()
      markDirty()
    })

    $("#f-slug").addEventListener("input", markDirty)

    $("#f-photo").addEventListener("change", async event => {
      const file = event.target.files[0]
      if (!file) return
      try {
        const converted = await convertPhoto(file)
        state.pendingPhoto = {
          blob: converted.blob,
          extension: converted.extension,
          fileName: `${$("#f-slug").value.trim() || slugify(currentName())}.${converted.extension}`,
          previewUrl: URL.createObjectURL(converted.blob)
        }
        state.removePhoto = false
        renderPhotoPreview()
        markDirty()
      } catch (error) {
        toast("Не удалось прочитать изображение", "error")
      }
    })

    $("#photo-remove").addEventListener("click", () => {
      state.pendingPhoto = null
      state.removePhoto = true
      renderPhotoPreview()
      markDirty()
    })

    $("#f-doc").addEventListener("change", event => {
      const file = event.target.files[0]
      if (!file) return
      if (!/\.pdf$/i.test(file.name)) {
        toast("Нужен PDF-файл", "error")
        return
      }
      state.documents.push({
        title: file.name.replace(/\.pdf$/i, ""),
        file
      })
      event.target.value = ""
      renderDocuments()
      markDirty()
    })

    $("#editor-form").addEventListener("input", event => {
      if (event.target.closest(".doc-row")) return
      if (event.target.id === "f-name" || event.target.id === "f-slug") return
      markDirty()
    })

    window.addEventListener("beforeunload", event => {
      if (!state.dirty) return
      event.preventDefault()
      event.returnValue = ""
    })
  }

  function initQuill() {
    state.quill = new Quill("#quill-editor", {
      theme: "snow",
      modules: {
        toolbar: [
          [{ header: [2, 3, false] }],
          ["bold", "italic", "underline"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["blockquote", "link"],
          ["clean"]
        ]
      }
    })

    state.quill.on("text-change", () => {
      if (state.filling) return
      markDirty()
    })
  }

  async function start() {
    bindEvents()
    initQuill()
    buildAwardSelect()

    const cached = readCache()
    if (cached) {
      state.veterans = cached.veterans
      state.awards = cached.awards || []
      buildAwardSelect()
    }

    if (!state.token) {
      showAuth()
      return
    }

    showApp()
    if (cached) {
      renderList()
      $("#sync-status").textContent = "Показан кэш, обновление…"
    }

    try {
      await loadAll()
      buildAwardSelect()
      renderList()
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        showAuth("Токен больше не действует или нет доступа к репозиторию.")
      } else {
        toast(`Не удалось загрузить данные: ${error.message}`, "error")
        $("#sync-status").textContent = cached ? "Работаем с кэшем" : "Нет данных"
      }
    }
  }

  document.addEventListener("DOMContentLoaded", start)
})()
