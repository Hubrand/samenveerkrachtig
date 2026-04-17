// ============================================================
// SAMEN VEERKRACHTIG — Forum onderwerp detail v6
// Wijzigingen: volg/ontvolg knop + notificatie bij nieuwe reply
//
// EXTRA WEBFLOW ELEMENTEN (naast de bestaande):
//   [data-sv="volg-knop"]       button/link — "Volg dit onderwerp"
//   [data-sv="volg-label"]      tekst binnen de knop (optioneel)
// ============================================================

(function () {

  const slug = new URLSearchParams(window.location.search).get('slug')
  let currentTopicId    = null
  let currentCategoryId = null
  let isSubscribed      = false

  async function loadTopic() {
    if (!slug) return

    let { data: topic } = await sv
      .from('topics')
      .select(`
        id, title, body, created_at, reply_count, is_closed, legacy_wp_slug,
        author:profiles!author_id(id, display_name, avatar_url),
        category:categories!category_id(id, name, slug)
      `)
      .eq('legacy_wp_slug', slug)
      .maybeSingle()

    if (!topic) {
      const { data } = await sv
        .from('topics')
        .select(`
          id, title, body, created_at, reply_count, is_closed, legacy_wp_slug,
          author:profiles!author_id(id, display_name, avatar_url),
          category:categories!category_id(id, name, slug)
        `)
        .eq('id', slug)
        .maybeSingle()
      topic = data
    }

    if (!topic) { console.warn('[SV] Topic niet gevonden:', slug); return }

    currentTopicId    = topic.id
    currentCategoryId = topic.category?.id
    document.title    = topic.title + ' — Samen Veerkrachtig Forum'

    svFill('topic-title',       topic.title)
    svFill('topic-author-name', topic.author?.display_name || 'Onbekend')
    svFill('topic-date',        formatDate(topic.created_at))
    svFill('topic-reply-count', topic.reply_count || 0)

    const catEl = document.querySelector('[data-sv="topic-category"]')
    if (catEl && topic.category) {
      catEl.textContent = topic.category.name
      if (catEl.tagName === 'A') catEl.href = '/forum/onderwerp?slug=' + topic.category.slug
    }

    setAvatar(
      document.querySelector('[data-sv="topic-author-avatar"]'),
      document.querySelector('[data-sv="topic-author-initials"]'),
      topic.author
    )

    const bodyEl = document.querySelector('[data-sv="topic-body"]')
    if (bodyEl) bodyEl.innerHTML = sanitize(topic.body || '')

    if (topic.is_closed) {
      const closedEl = document.querySelector('[data-sv="topic-closed"]')
      if (closedEl) closedEl.style.display = ''
      const replyForm = document.querySelector('[data-sv="reply-form"]')
      if (replyForm) replyForm.style.display = 'none'
    }

    await Promise.all([
      loadReplies(topic.id),
      loadRelated(topic.id, topic.category?.id),
      loadSubscriptionStatus(topic.id),
    ])

    initQuill()
  }

  // ── ABONNEMENT STATUS ─────────────────────────────────────
  async function loadSubscriptionStatus(topicId) {
    const volgKnop = document.querySelector('[data-sv="volg-knop"]')
    if (!volgKnop || !window.svUser) return

    const { data } = await sv
      .from('topic_subscriptions')
      .select('id')
      .eq('topic_id', topicId)
      .eq('user_id', window.svUser.id)
      .maybeSingle()

    isSubscribed = !!data
    updateVolgKnop()

    volgKnop.addEventListener('click', async function(e) {
      e.preventDefault()
      if (!window.svUser) {
        window.location.href = '/account/login?redirect=' + encodeURIComponent(window.location.href)
        return
      }
      await toggleSubscription(topicId)
    })
  }

  async function toggleSubscription(topicId) {
    if (isSubscribed) {
      await sv.from('topic_subscriptions')
        .delete()
        .eq('topic_id', topicId)
        .eq('user_id', window.svUser.id)
      isSubscribed = false
    } else {
      await sv.from('topic_subscriptions')
        .insert({ topic_id: topicId, user_id: window.svUser.id })
      isSubscribed = true
    }
    updateVolgKnop()
  }

  function updateVolgKnop() {
    const volgKnop  = document.querySelector('[data-sv="volg-knop"]')
    const volgLabel = document.querySelector('[data-sv="volg-label"]')
    if (!volgKnop) return

    if (isSubscribed) {
      volgKnop.setAttribute('data-volgend', '')
      if (volgLabel) volgLabel.textContent = 'Ontvolgen'
      else volgKnop.title = 'Ontvolgen'
    } else {
      volgKnop.removeAttribute('data-volgend')
      if (volgLabel) volgLabel.textContent = 'Volg dit onderwerp'
      else volgKnop.title = 'Volg dit onderwerp'
    }
  }

  // ── REPLIES LADEN ────────────────────────────────────────
  async function loadReplies(topicId) {
    const container = document.querySelector('[data-sv="replies-list"]')
    const template  = document.querySelector('[data-sv="reply-template"]')
    if (!container || !template) return

    container.innerHTML = '<p style="opacity:.5">Reacties laden...</p>'

    const { data: replies } = await sv
      .from('replies')
      .select(`
        id, body, created_at, is_solution,
        author:profiles!author_id(id, display_name, avatar_url)
      `)
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true })

    template.style.display = 'none'
    container.innerHTML = ''

    if (!replies || replies.length === 0) {
      container.innerHTML = '<p style="opacity:.5">Nog geen reacties. Wees de eerste!</p>'
      return
    }

    replies.forEach(reply => {
      const card = template.cloneNode(true)
      card.removeAttribute('data-sv')
      card.style.display = ''
      if (reply.is_solution) card.setAttribute('data-solution', '')

      fillEl(card, 'reply-author-name', reply.author?.display_name || 'Onbekend')
      fillEl(card, 'reply-date',        formatDate(reply.created_at))

      const bodyEl = card.querySelector('[data-sv="reply-body"]')
      if (bodyEl) bodyEl.innerHTML = sanitize(reply.body || '')

      setAvatar(
        card.querySelector('[data-sv="reply-author-avatar"]'),
        card.querySelector('[data-sv="reply-author-initials"]'),
        reply.author
      )

      const deleteBtn = card.querySelector('[data-sv="reply-delete"]')
      if (deleteBtn) {
        const isOwn   = window.svProfile?.id === reply.author?.id
        const isAdmin = window.svProfile?.is_admin || window.svProfile?.is_moderator
        if (isOwn || isAdmin) {
          deleteBtn.style.display = ''
          deleteBtn.addEventListener('click', () => {
            if (confirm('Reactie verwijderen?')) {
              sv.from('replies').delete().eq('id', reply.id).then(({ error }) => {
                if (!error) card.remove()
              })
            }
          })
        } else {
          deleteBtn.style.display = 'none'
        }
      }

      container.appendChild(card)
    })
  }

  // ── GERELATEERDE BERICHTEN ───────────────────────────────
  async function loadRelated(topicId, categoryId) {
    const container = document.querySelector('[data-sv="related-list"]')
    const template  = document.querySelector('[data-sv="related-template"]')
    if (!container || !template) return
    if (!categoryId) { template.style.display = 'none'; return }

    const { data: related } = await sv
      .from('topics')
      .select(`
        id, title, created_at, reply_count, legacy_wp_slug,
        author:profiles!author_id(display_name),
        category:categories!category_id(name, slug)
      `)
      .eq('category_id', categoryId)
      .neq('id', topicId)
      .order('reply_count', { ascending: false })
      .limit(4)

    template.style.display = 'none'
    container.innerHTML = ''
    if (!related || related.length === 0) return

    related.forEach(topic => {
      const card = template.cloneNode(true)
      card.removeAttribute('data-sv')
      card.style.display = ''

      const topicSlug = topic.legacy_wp_slug || topic.id
      const url = '/forum/onderwerp-detail?slug=' + topicSlug

      fillEl(card, 'related-title',       topic.title)
      fillEl(card, 'related-category',    topic.category?.name || '')
      fillEl(card, 'related-author-name', topic.author?.display_name || 'Onbekend')
      fillEl(card, 'related-date',        formatDate(topic.created_at))
      fillEl(card, 'related-reply-count', topic.reply_count || 0)

      const linkEl = card.querySelector('[data-sv="related-link"]')
      if (linkEl) linkEl.href = url
      else {
        card.style.cursor = 'pointer'
        card.addEventListener('click', () => window.location.href = url)
      }

      container.appendChild(card)
    })
  }

  // ── QUILL EDITOR ─────────────────────────────────────────
  let quillEditor = null

  function initQuill() {
    const editorEl = document.querySelector('[data-sv="reply-input"]')
    if (!editorEl || typeof Quill === 'undefined') return

    quillEditor = new Quill(editorEl, {
      theme: 'snow',
      placeholder: 'Schrijf je reactie...',
      modules: {
        toolbar: [
          ['bold', 'italic', 'strike'],
          ['link'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['clean']
        ]
      }
    })
  }

  // ── REPLY PLAATSEN ───────────────────────────────────────
  const replyForm = document.querySelector('[data-sv="reply-form"]')
  if (replyForm) {
    replyForm.addEventListener('submit', async function (e) {
      e.preventDefault()
      e.stopPropagation()
      if (!currentTopicId || !window.svUser) return

      const errorEl = document.querySelector('[data-sv="reply-error"]')
      const btn     = replyForm.querySelector('button[type="submit"]')

      let body = ''
      if (quillEditor) {
        const text = quillEditor.getText().trim()
        if (!text || text.length < 5) {
          if (errorEl) { errorEl.textContent = 'Je reactie is te kort.'; errorEl.style.display = '' }
          return
        }
        body = quillEditor.getSemanticHTML()
      } else {
        const input = document.querySelector('[data-sv="reply-input"]')
        body = input?.value?.trim() || ''
        if (body.length < 5) {
          if (errorEl) { errorEl.textContent = 'Je reactie is te kort.'; errorEl.style.display = '' }
          return
        }
      }

      if (btn) { btn.disabled = true; btn.textContent = 'Plaatsen...' }
      if (errorEl) errorEl.style.display = 'none'

      const { data: newReply, error } = await sv.from('replies').insert({
        topic_id:  currentTopicId,
        author_id: window.svUser.id,
        body
      }).select('id').single()

      if (btn) { btn.disabled = false; btn.textContent = 'Reactie plaatsen' }

      if (error) {
        if (errorEl) { errorEl.textContent = 'Er ging iets mis. Probeer het opnieuw.'; errorEl.style.display = '' }
      } else {
        if (quillEditor) quillEditor.setContents([])
        else {
          const input = document.querySelector('[data-sv="reply-input"]')
          if (input) input.value = ''
        }

        await loadReplies(currentTopicId)

        // ✅ Notificeer abonnees via Edge Function
        const authorName = window.svProfile?.display_name || 'Iemand'
        fetch('https://vavwwyelfyvijumgmemi.supabase.co/functions/v1/notify-subscribers', {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': 'Bearer ' + (await sv.auth.getSession()).data.session?.access_token,
          },
          body: JSON.stringify({
            topic_id:           currentTopicId,
            reply_author_name:  authorName,
            reply_body_preview: body,
          })
        }).catch(function() {}) // stil falen — notificatie is niet kritiek

        // Scroll naar nieuwe reply
        setTimeout(() => {
          const list = document.querySelector('[data-sv="replies-list"]')
          const lastReply = list?.lastElementChild
          if (lastReply) lastReply.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 300)
      }
    })
  }

  // ── HELPERS ──────────────────────────────────────────────
  function fillEl(parent, val, text) {
    const el = parent.querySelector('[data-sv="' + val + '"]')
    if (el) el.textContent = text
  }

  function setAvatar(avatarEl, initialsEl, author) {
    if (author?.avatar_url) {
      if (avatarEl)   avatarEl.src = author.avatar_url
      if (initialsEl) initialsEl.style.display = 'none'
    } else {
      if (avatarEl)   avatarEl.style.display = 'none'
      if (initialsEl) initialsEl.textContent = getInitials(author?.display_name)
    }
  }

  function sanitize(html) {
    if (!html) return ''
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    html = html.replace(/\s*on\w+="[^"]*"/gi, '')
    html = html.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    html = html.replace(/<img[^>]*class="[^"]*graemlin[^"]*"[^>]*>/gi, '')
    html = html.replace(/\[@mention:[^\]]+\]/g, '')
    if (!html.includes('<p>') && !html.includes('<br')) {
      html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
      html = '<p>' + html.split(/\n\n+/).map(p => p.replace(/\n/g, '<br>')).join('</p><p>') + '</p>'
    }
    return html
  }

  function formatDate(str) {
    if (!str) return ''
    return new Date(str).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  function getInitials(name) {
    if (!name) return '?'
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  }

  loadTopic()

})()
