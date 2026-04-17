// ============================================================
// SAMEN VEERKRACHTIG — Mijn profiel pagina v3
// Plak dit in: Webflow → Page Settings → Before </body>
//
// WEBFLOW STRUCTUUR NODIG:
//
// PROFIEL HEADER:
//   [data-sv="avatar"]                img — profielfoto
//   [data-sv="avatar-initials"]       div — initialen fallback
//   [data-sv="username"]              tekst — weergavenaam
//   [data-sv="profile-since"]         tekst — lid sinds datum
//   [data-sv="my-topic-count"]        tekst — aantal topics
//   [data-sv="my-reply-count"]        tekst — aantal reacties
//
// AVATAR UPLOAD (buiten Form Block):
//   [data-sv="avatar-btn"]            knop/link — "Foto uploaden"
//   [data-sv="avatar-error"]          div — foutmelding (display:none)
//
// PROFIEL BEWERKEN (Webflow Form Block):
//   [data-sv="profile-form"]          Form element (niet Form Block!)
//   [data-sv="profile-name-input"]    input — naam voorgevuld
//   [data-sv="profile-bio-input"]     textarea — bio voorgevuld
//   [data-sv="profile-email-display"] tekst — huidig e-mailadres (read-only)
//   [data-sv="profile-email-input"]   input — nieuw e-mailadres (leeg = niet wijzigen)
//   [data-sv="profile-save"]          submit button (type="submit")
//   [data-sv="profile-success"]       div — bevestiging (display:none)
//   [data-sv="profile-error"]         div — foutmelding (display:none)
//
// EIGEN TOPICS:
//   [data-sv="my-topics-list"]        lege container
//   [data-sv="my-card-template"]      gestijlde card — zichtbaar in designer, buiten lijst
//     [data-sv="card-title"]
//     [data-sv="card-category"]
//     [data-sv="card-date"]
//     [data-sv="card-reply-count"]
//     [data-sv="card-link"]           a element
//
// ACCOUNT:
//   [data-sv="logout"]                button — uitloggen
// ============================================================

(function () {

  // ── AUTH CHECK ────────────────────────────────────────────
  async function waitForAuth() {
    return new Promise(resolve => {
      if (window.svUser !== undefined) { resolve(window.svUser); return }
      window.addEventListener('sv:auth-ready', () => {
        resolve(window.svUser)
      }, { once: true })
      setTimeout(() => resolve(window.svUser || null), 8000)
    })
  }

  async function init() {
    const user = await waitForAuth()
    if (!user) {
      window.location.href = '/account/login?redirect=' + encodeURIComponent(window.location.pathname)
      return
    }

    // Welkomstbanner voor nieuwe gebruikers
    if (new URLSearchParams(window.location.search).get('welkom') === '1') {
      const successEl = document.querySelector('[data-sv="profile-success"]')
      if (successEl) {
        successEl.textContent = 'Welkom! Stel hieronder je naam in om te beginnen.'
        successEl.style.display = ''
      }
    }

    await loadProfile(user)
    loadStats(user)
    loadMyTopics(user)
    initForm(user)
    initAvatarUpload(user)
    initLogout()
  }

  // ── PROFIEL LADEN ─────────────────────────────────────────
  async function loadProfile(user) {
    const { data: profile } = await sv
      .from('profiles')
      .select('display_name, username, avatar_url, bio, created_at')
      .eq('id', user.id)
      .single()

    if (!profile) return

    svFill('username',      profile.display_name || profile.username || 'Onbekend')
    svFill('profile-since', 'Lid sinds ' + formatDate(profile.created_at))
    svFill('profile-bio',   profile.bio || '')

    // Avatar of initialen
    const avatarEl   = document.querySelector('[data-sv="avatar"]')
    const initialsEl = document.querySelector('[data-sv="avatar-initials"]')
    if (profile.avatar_url) {
      if (avatarEl)   { avatarEl.src = profile.avatar_url; avatarEl.style.display = '' }
      if (initialsEl) initialsEl.style.display = 'none'
    } else {
      if (avatarEl)   avatarEl.style.display = 'none'
      if (initialsEl) initialsEl.textContent = getInitials(profile.display_name)
    }

    // Formulier voorvullen
    const nameInput = document.querySelector('[data-sv="profile-name-input"]')
    if (nameInput) nameInput.value = profile.display_name || ''

    const bioInput = document.querySelector('[data-sv="profile-bio-input"]')
    if (bioInput) bioInput.value = profile.bio || ''

    const emailDisplay = document.querySelector('[data-sv="profile-email-display"]')
    if (emailDisplay) emailDisplay.textContent = user.email || ''
  }

  // ── STATISTIEKEN ──────────────────────────────────────────
  async function loadStats(user) {
    const [topics, replies] = await Promise.all([
      sv.from('topics').select('id', { count: 'exact', head: true }).eq('author_id', user.id),
      sv.from('replies').select('id', { count: 'exact', head: true }).eq('author_id', user.id),
    ])
    svFill('my-topic-count', topics.count || 0)
    svFill('my-reply-count', replies.count || 0)
  }

  // ── EIGEN TOPICS ──────────────────────────────────────────
  async function loadMyTopics(user) {
    const container = document.querySelector('[data-sv="my-topics-list"]')
    const template  = document.querySelector('[data-sv="my-card-template"]')
    if (!container || !template) return

    container.innerHTML = '<p style="opacity:.5">Laden...</p>'

    const { data: topics } = await sv
      .from('topics')
      .select(`
        id, title, created_at, reply_count, legacy_wp_slug,
        category:categories!category_id(name)
      `)
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    template.style.display = 'none'
    container.innerHTML = ''

    if (!topics || topics.length === 0) {
      container.innerHTML = '<p style="opacity:.5">Je hebt nog geen berichten geplaatst.</p>'
      return
    }

    topics.forEach(topic => {
      const card = template.cloneNode(true)
      card.removeAttribute('data-sv')
      card.style.display = ''

      const slug = topic.legacy_wp_slug || topic.id
      const url  = '/forum/onderwerp-detail?slug=' + slug

      fillEl(card, 'card-title',       topic.title)
      fillEl(card, 'card-category',    topic.category?.name || '')
      fillEl(card, 'card-date',        formatDate(topic.created_at))
      fillEl(card, 'card-reply-count', topic.reply_count || 0)

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

  // ── AVATAR UPLOAD ─────────────────────────────────────────
  function initAvatarUpload(user) {
    const uploadBtn = document.querySelector('[data-sv="avatar-btn"]')
    const errorEl   = document.querySelector('[data-sv="avatar-error"]')
    if (!uploadBtn) return

    // Maak verborgen file input aan via JS — geen Webflow element nodig
    const fileInput   = document.createElement('input')
    fileInput.type    = 'file'
    fileInput.accept  = 'image/jpeg,image/png,image/webp'
    fileInput.style.display = 'none'
    document.body.appendChild(fileInput)

    // Knop opent file picker
    uploadBtn.addEventListener('click', (e) => {
      e.preventDefault()
      fileInput.click()
    })

    fileInput.addEventListener('change', async function () {
      const file = this.files[0]
      if (!file) return

      if (file.size > 2 * 1024 * 1024) {
        if (errorEl) { errorEl.textContent = 'Foto mag maximaal 2MB zijn.'; errorEl.style.display = '' }
        return
      }

      const originalText    = uploadBtn.textContent
      uploadBtn.textContent = 'Uploaden...'
      uploadBtn.style.pointerEvents = 'none'
      if (errorEl) errorEl.style.display = 'none'

      // Upload naar Supabase Storage — pad: {user-id}/avatar.{ext}
      const ext      = file.name.split('.').pop().toLowerCase()
      const filePath = `${user.id}/avatar.${ext}`

      const { error: uploadError } = await sv.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        if (errorEl) { errorEl.textContent = 'Upload mislukt: ' + uploadError.message; errorEl.style.display = '' }
        uploadBtn.textContent = originalText
        uploadBtn.style.pointerEvents = ''
        return
      }

      // Publieke URL ophalen
      const { data } = sv.storage.from('avatars').getPublicUrl(filePath)
      const avatarUrl = data.publicUrl + '?t=' + Date.now() // cache busting

      // Opslaan in profiel
      await sv.from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id)

      // UI bijwerken
      const avatarEl   = document.querySelector('[data-sv="avatar"]')
      const initialsEl = document.querySelector('[data-sv="avatar-initials"]')
      if (avatarEl)   { avatarEl.src = avatarUrl; avatarEl.style.display = '' }
      if (initialsEl) initialsEl.style.display = 'none'

      // Ook in navigatie bijwerken
      document.querySelectorAll('[data-sv="avatar"]')
        .forEach(el => { if (el.tagName === 'IMG') el.src = avatarUrl })

      uploadBtn.textContent = originalText
      uploadBtn.style.pointerEvents = ''
    })
  }

  // ── PROFIEL OPSLAAN ───────────────────────────────────────
  function initForm(user) {
    const form      = document.querySelector('[data-sv="profile-form"]')
    const successEl = document.querySelector('[data-sv="profile-success"]')
    const errorEl   = document.querySelector('[data-sv="profile-error"]')
    if (!form) return

    // ✅ Webflow form submit onderscheppen
    form.addEventListener('submit', async function (e) {
      e.preventDefault()
      e.stopPropagation()

      const nameInput  = document.querySelector('[data-sv="profile-name-input"]')
      const bioInput   = document.querySelector('[data-sv="profile-bio-input"]')
      const emailInput = document.querySelector('[data-sv="profile-email-input"]')
      const saveBtn    = document.querySelector('[data-sv="profile-save"]')

      const newName  = nameInput?.value.trim()
      const newBio   = bioInput?.value.trim() || ''
      const newEmail = emailInput?.value.trim()

      if (!newName || newName.length < 2) {
        showMsg(errorEl, 'Naam moet minimaal 2 tekens zijn.')
        return
      }

      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Opslaan...' }
      if (successEl) successEl.style.display = 'none'
      if (errorEl)   errorEl.style.display   = 'none'

      let hasError = false

      // Naam + bio opslaan
      const { error: profileError } = await sv
        .from('profiles')
        .update({
          display_name: newName,
          bio:          newBio,
          updated_at:   new Date().toISOString()
        })
        .eq('id', user.id)

      if (profileError) {
        showMsg(errorEl, 'Er ging iets mis bij het opslaan.')
        hasError = true
      }

      // E-mail wijzigen — alleen als ingevuld en anders dan huidig
      if (!hasError && newEmail && newEmail !== user.email) {
        const { error: emailError } = await sv.auth.updateUser({ email: newEmail })
        if (emailError) {
          showMsg(errorEl, 'E-mailadres kon niet worden gewijzigd: ' + emailError.message)
          hasError = true
        } else {
          if (emailInput) emailInput.value = ''
          showMsg(successEl, 'Opgeslagen! Controleer je nieuwe e-mailadres voor een bevestigingsmail.')
        }
      }

      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Opslaan' }

      if (!hasError && (!newEmail || newEmail === user.email)) {
        showMsg(successEl, 'Profiel opgeslagen!')
        svFill('username',    newName)
        svFill('profile-bio', newBio)
        const initialsEl = document.querySelector('[data-sv="avatar-initials"]')
        if (initialsEl && !document.querySelector('[data-sv="avatar"]')?.src) {
          initialsEl.textContent = getInitials(newName)
        }
      }
    })
  }

  // ── UITLOGGEN ─────────────────────────────────────────────
  function initLogout() {
    const logoutBtn = document.querySelector('[data-sv="logout"]')
    if (!logoutBtn) return
    logoutBtn.addEventListener('click', async () => {
      await sv.auth.signOut()
      window.location.href = '/'
    })
  }

  // ── HELPERS ───────────────────────────────────────────────
  function fillEl(parent, val, text) {
    const el = parent.querySelector('[data-sv="' + val + '"]')
    if (el) el.textContent = text
  }

  function showMsg(el, msg) {
    if (!el) return
    el.textContent = msg
    el.style.display = ''
  }

  function formatDate(str) {
    if (!str) return ''
    return new Date(str).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  function getInitials(name) {
    if (!name) return '?'
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  }

  init()

})()
