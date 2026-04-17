// ============================================================
// SAMEN VEERKRACHTIG — Forum onderwerp (categorie) pagina
// Webflow pagina URL: /forum/onderwerp
// Plak dit in: Webflow → Page Settings → Before </body>
//
// Leest ?slug=werk uit de URL en toont alle topics van die categorie.
// Gebruikt dezelfde Webflow structuur als het forum overzicht.
//
// EXTRA element op deze pagina:
//   [data-sv="onderwerp-naam"]    tekst — naam van de categorie
//   [data-sv="onderwerp-beschrijving"] tekst — beschrijving (optioneel)
//
// De rest van de structuur (card-template, topics-list etc.)
// is identiek aan het forum overzicht.
// ============================================================

(function () {

  // Lees categorie slug uit ?slug= parameter
  const categorySlug = new URLSearchParams(window.location.search).get('slug')
  let categoryId = null

  async function init() {
    if (!categorySlug) {
      // Geen slug → terug naar forum overzicht
      window.location.href = '/forum'
      return
    }

    // Haal categorie op
    const { data: cat } = await sv
      .from('categories')
      .select('id, name, description')
      .eq('slug', categorySlug)
      .single()

    if (!cat) {
      window.location.href = '/forum'
      return
    }

    categoryId = cat.id

    // Paginatitel + naam invullen
    document.title = cat.name + ' — Samen Veerkrachtig Forum'
    svFill('onderwerp-naam', cat.name)
    svFill('onderwerp-beschrijving', cat.description || '')

    loadTopics()
  }

  // ── TOPICS LADEN (gefilterd op categorie) ────────────────
  async function loadTopics() {
    const container = document.querySelector('[data-sv="topics-list"]')
    const template  = document.querySelector('[data-sv="card-template"]')
    if (!container) { console.warn('[SV] topics-list niet gevonden'); return }
    if (!template)  { console.warn('[SV] card-template niet gevonden'); return }

    container.innerHTML = '<p style="opacity:.5;padding:1rem 0">Laden...</p>'

    const { data: topics, error } = await sv
      .from('topics')
      .select(`
        id, title, created_at, reply_count, legacy_wp_slug, is_pinned,
        author:profiles!author_id(display_name, avatar_url),
        category:categories!category_id(name, slug)
      `)
      .eq('category_id', categoryId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      container.innerHTML = '<p style="opacity:.5">Er ging iets mis.</p>'
      return
    }

    template.style.display = 'none'
    container.innerHTML = ''

    if (!topics || topics.length === 0) {
      container.innerHTML = '<p style="opacity:.5">Nog geen berichten in dit onderwerp.</p>'
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

  init()

})()
