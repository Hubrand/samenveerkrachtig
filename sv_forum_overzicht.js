// ============================================================
// SAMEN VEERKRACHTIG — Forum overzicht v8
// Plak dit in: Webflow → Page Settings → Before </body>
//
// WEBFLOW STRUCTUUR:
//   [data-sv="search-form"]        Form element van de zoekbalk Form Block
//   [data-sv="category-filters"]   container voor chips
//   [data-sv="chip-template"]      één chip — zichtbaar in designer
//     [data-sv="chip-label"]       categorienaam
//     [data-sv="chip-count"]       aantal berichten (optioneel)
//   [data-sv="topics-list"]        lege container
//   [data-sv="card-template"]      één topic card — zichtbaar in designer
//     [data-sv="card-title"]
//     [data-sv="card-author-avatar"]
//     [data-sv="card-author-initials"]
//     [data-sv="card-author-name"]
//     [data-sv="card-date"]
//     [data-sv="card-category"]
//     [data-sv="card-reply-count"]
//     [data-sv="card-link"]
//   [data-sv="search"]             input element
//   [data-sv="stat-topics"]        tekst
//   [data-sv="stat-replies"]       tekst
//   [data-sv="stat-members"]       tekst
// ============================================================

(function () {

  let searchQuery = ''
  let searchTimer = null

  // ── FORM SUBMIT ONDERSCHEPPEN ─────────────────────────────
  // Voorkomt dat Webflow emails stuurt bij form submit
  const searchForm = document.querySelector('[data-sv="search-form"]')
  if (searchForm) {
    searchForm.addEventListener('submit', function (e) {
      e.preventDefault()
      e.stopPropagation()
      // Bij enter → zoek direct
      const val = document.querySelector('[data-sv="search"]')?.value.trim()
      if (val && val.length >= 2) {
        searchQuery = val
        loadTopics()
      }
    }, true) // true = capture phase, vangt Webflow's eigen handler af
  }

  // ── STATISTIEKEN ─────────────────────────────────────────
  async function loadStats() {
    const [topics, replies, members] = await Promise.all([
      sv.from('topics').select('id', { count: 'exact', head: true }),
      sv.from('replies').select('id', { count: 'exact', head: true }),
      sv.from('pending_auth_users').select('id', { count: 'exact', head: true })
    ])
    const fmt = n => (n || 0).toLocaleString('nl-NL')
    svFill('stat-topics',  fmt(topics.count))
    svFill('stat-replies', fmt(replies.count))
    svFill('stat-members', fmt(members.count))
  }

  // ── CATEGORIE CHIPS ───────────────────────────────────────
  async function loadCategories() {
    const container    = document.querySelector('[data-sv="category-filters"]')
    const chipTemplate = document.querySelector('[data-sv="chip-template"]')

    if (!container || !chipTemplate) {
      loadTopics()
      return
    }

    const { data: cats } = await sv
      .from('categories')
      .select(`
        id, name, slug, sort_order,
        topics:topics(count)
      `)
      .order('sort_order')

    if (!cats) { loadTopics(); return }

    chipTemplate.style.display = 'none'
    container.innerHTML = ''

    cats.forEach(cat => {
      const count = cat.topics?.[0]?.count || 0

      const chip = chipTemplate.cloneNode(true)
      chip.removeAttribute('data-sv')
      chip.style.display = ''

      const label = chip.querySelector('[data-sv="chip-label"]')
      if (label) label.textContent = cat.name

      const countEl = chip.querySelector('[data-sv="chip-count"]')
      if (countEl) countEl.textContent = count

      // Link naar /forum/onderwerp?slug=
      if (chip.tagName === 'A') {
        chip.href = '/forum/onderwerp?slug=' + cat.slug
      } else {
        chip.style.cursor = 'pointer'
        chip.addEventListener('click', () => {
          window.location.href = '/forum/onderwerp?slug=' + cat.slug
        })
      }

      container.appendChild(chip)
    })

    loadTopics()
  }

  // ── TOPICS LADEN ─────────────────────────────────────────
  async function loadTopics() {
    const container = document.querySelector('[data-sv="topics-list"]')
    const template  = document.querySelector('[data-sv="card-template"]')
    if (!container) { console.warn('[SV] topics-list niet gevonden'); return }
    if (!template)  { console.warn('[SV] card-template niet gevonden'); return }

    container.innerHTML = '<p style="opacity:.5;padding:1rem 0">Laden...</p>'

    let query = sv
      .from('topics')
      .select(`
        id, title, created_at, reply_count, legacy_wp_slug, is_pinned,
        author:profiles!author_id(display_name, avatar_url),
        category:categories!category_id(name, slug)
      `)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10)

    if (searchQuery.length > 2) query = query.ilike('title', '%' + searchQuery + '%')

    const { data: topics, error } = await query

    if (error) {
      container.innerHTML = '<p style="opacity:.5">Er ging iets mis.</p>'
      return
    }

    template.style.display = 'none'
    container.innerHTML = ''

    if (!topics || topics.length === 0) {
      container.innerHTML = '<p style="opacity:.5">Geen berichten gevonden.</p>'
      return
    }

    topics.forEach(topic => {
      const card = template.cloneNode(true)
      card.removeAttribute('data-sv')
      card.style.display = ''

      const slug = topic.legacy_wp_slug || topic.id
      const url  = '/forum/onderwerp-detail?slug=' + slug

      fillEl(card, 'card-title',       topic.title)
      fillEl(card, 'card-author-name', topic.author?.display_name || 'Onbekend')
      fillEl(card, 'card-date',        formatDate(topic.created_at))
      fillEl(card, 'card-category',    topic.category?.name || '')
      fillEl(card, 'card-reply-count', topic.reply_count || 0)

      const avatarEl   = card.querySelector('[data-sv="card-author-avatar"]')
      const initialsEl = card.querySelector('[data-sv="card-author-initials"]')
      if (topic.author?.avatar_url) {
        if (avatarEl)   avatarEl.src = topic.author.avatar_url
        if (initialsEl) initialsEl.style.display = 'none'
      } else {
        if (avatarEl)   avatarEl.style.display = 'none'
        if (initialsEl) initialsEl.textContent = getInitials(topic.author?.display_name)
      }

      const linkEl = card.querySelector('[data-sv="card-link"]')
      if (linkEl) {
        linkEl.href = url
      } else {
        card.style.cursor = 'pointer'
        card.addEventListener('click', () => window.location.href = url)
      }

      container.appendChild(card)
    })
  }

  // ── ZOEKEN ────────────────────────────────────────────────
  const searchEl = document.querySelector('[data-sv="search"]')
  if (searchEl) {
    searchEl.addEventListener('input', function () {
      clearTimeout(searchTimer)
      searchQuery = this.value.trim()
      searchTimer = setTimeout(loadTopics, 350)
    })
  }

  // ── HELPERS ──────────────────────────────────────────────
  function fillEl(parent, val, text) {
    const el = parent.querySelector('[data-sv="' + val + '"]')
    if (el) el.textContent = text
  }
  function formatDate(str) {
    if (!str) return ''
    return new Date(str).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  function getInitials(name) {
    if (!name) return '?'
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  }

  loadStats()
  loadCategories()

})()
