// ============================================================
// SAMEN VEERKRACHTIG — Nieuw bericht pagina v3
// Plak dit in: Webflow → Page Settings → Before </body>
//
// WEBFLOW STRUCTUUR NODIG:
//
//   Tekst  [data-sv="nieuw-topic-categorie-naam"]   ← "Je start een bericht in: ..."
//
//   Form Block (Action: /forum, Method: GET)
//     └── Form  [data-sv="nieuw-topic-form"]
//           ├── Input (text)  [data-sv="topic-titel"]
//           │
//           ├── Div  [data-sv="categorie-opties"]        ← lege container voor radiobuttons
//           ├── Div  [data-sv="categorie-template"]      ← één gestijlde rij — display:none
//           │     ├── Input (radio)  [data-sv="categorie-radio"]
//           │     └── Label          [data-sv="categorie-naam"]
//           │
//           ├── Div  [data-sv="topic-body-input"]        ← Quill editor (min-height 200px)
//           │
//           ├── Div  [data-sv="topic-abonneer"]          ← checkbox wrapper
//           │     └── Input (checkbox)  [data-sv="topic-abonneer-checkbox"]
//           │
//           ├── Button  [data-sv="submit-topic"]  "Bericht plaatsen"
//           ├── Div  [data-sv="topic-success"]           display:none
//           └── Div  [data-sv="topic-error"]             display:none
// ============================================================

(function () {

  async function waitForAuth() {
    return new Promise(function(resolve) {
      if (window.svUser !== undefined) { resolve(window.svUser); return }
      window.addEventListener('sv:auth-ready', function() {
        resolve(window.svUser)
      }, { once: true })
      setTimeout(function() { resolve(null) }, 8000)
    })
  }

  async function init() {
    var user = await waitForAuth()
    if (!user) {
      window.location.href = '/account/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search)
      return
    }
    // ✅ Quill direct initialiseren — niet wachten op categorieën
    initQuill()
    // Categorieën en form parallel
    await loadCategories()
    initForm(user)
  }

  // ── CATEGORIEËN ALS RADIOBUTTONS ─────────────────────────
  async function loadCategories() {
    var container = document.querySelector('[data-sv="categorie-opties"]')
    var template  = document.querySelector('[data-sv="categorie-template"]')
    if (!container || !template) return

    var { data: cats } = await sv
      .from('categories')
      .select('id, name, slug')
      .order('sort_order')

    if (!cats) return

    // Lees voorgeselecteerde categorie uit URL
    var urlSlug = new URLSearchParams(window.location.search).get('categorie')
    var naamEl  = document.querySelector('[data-sv="nieuw-topic-categorie-naam"]')

    template.style.display = 'none'
    container.innerHTML = ''

    cats.forEach(function(cat) {
      var item  = template.cloneNode(true)
      item.removeAttribute('data-sv')
      item.style.display = ''

      var radio = item.querySelector('[data-sv="categorie-radio"]')
      var label = item.querySelector('[data-sv="categorie-naam"]')

      if (radio) {
        radio.value = cat.id
        radio.name  = 'categorie'
        radio.id    = 'cat-' + cat.id

        // ✅ Automatisch aanklikken als categorie in URL staat
        if (cat.slug === urlSlug) {
          radio.checked = true
          if (naamEl) naamEl.textContent = 'Je start een bericht in: ' + cat.name
        }

        // Update naam als gebruiker van categorie wisselt
        radio.addEventListener('change', function() {
          if (naamEl) naamEl.textContent = 'Je start een bericht in: ' + cat.name
        })
      }

      if (label) {
        label.textContent = cat.name
        label.htmlFor     = 'cat-' + cat.id
      }

      container.appendChild(item)
    })
  }

  // ── QUILL EDITOR ─────────────────────────────────────────
  var quillEditor = null

  function initQuill() {
    var editorEl = document.querySelector('[data-sv="topic-body-input"]')
    if (!editorEl || typeof Quill === 'undefined') return

    quillEditor = new Quill(editorEl, {
      theme: 'snow',
      placeholder: 'Beschrijf je vraag of verhaal...',
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

  // ── FORM SUBMIT ───────────────────────────────────────────
  function initForm(user) {
    var successEl = document.querySelector('[data-sv="topic-success"]')
    var errorEl   = document.querySelector('[data-sv="topic-error"]')
    var btn       = document.querySelector('[data-sv="submit-topic"]')
    if (!btn) return

    btn.addEventListener('click', async function(e) {
      e.preventDefault()
      e.stopPropagation()

      var titelInput    = document.querySelector('[data-sv="topic-titel"]')
      var radioChecked  = document.querySelector('[data-sv="categorie-radio"]:checked')
      var abonneerCheck = document.querySelector('[data-sv="topic-abonneer-checkbox"]')

      var titel       = titelInput?.value.trim()
      var categorieId = radioChecked ? radioChecked.value : null

      // Validatie
      if (!titel || titel.length < 5) {
        showMsg(errorEl, 'Geef je bericht een titel van minimaal 5 tekens.')
        return
      }
      if (!categorieId) {
        showMsg(errorEl, 'Kies een onderwerp voor je bericht.')
        return
      }

      // Body ophalen uit Quill
      var body = ''
      if (quillEditor) {
        var text = quillEditor.getText().trim()
        if (!text || text.length < 10) {
          showMsg(errorEl, 'Je bericht is te kort. Schrijf minimaal een paar zinnen.')
          return
        }
        body = quillEditor.getSemanticHTML()
      } else {
        var bodyEl = document.querySelector('[data-sv="topic-body-input"]')
        body = bodyEl?.innerText?.trim() || ''
        if (body.length < 10) {
          showMsg(errorEl, 'Je bericht is te kort.')
          return
        }
      }

      btn.disabled = true
      btn.textContent = 'Plaatsen...'
      if (successEl) successEl.style.display = 'none'
      if (errorEl)   errorEl.style.display   = 'none'

      // Topic opslaan
      var { data: newTopic, error: topicError } = await sv
        .from('topics')
        .insert({
          title:       titel,
          body:        body,
          author_id:   user.id,
          category_id: categorieId,
        })
        .select('id, legacy_wp_slug')
        .single()

      if (topicError || !newTopic) {
        btn.disabled = false
        btn.textContent = 'Bericht plaatsen'
        showMsg(errorEl, 'Er ging iets mis. Probeer het opnieuw.')
        return
      }

      // ✅ Automatisch abonneren als checkbox aangevinkt (standaard aan)
      var abonneer = !abonneerCheck || abonneerCheck.checked
      if (abonneer) {
        await sv.from('topic_subscriptions').insert({
          topic_id: newTopic.id,
          user_id:  user.id,
        }).catch(function() {})
      }

      // Doorsturen naar het nieuwe topic
      var slug = newTopic.legacy_wp_slug || newTopic.id
      window.location.href = '/forum/onderwerp-detail?slug=' + slug
    })
  }

  // ── HELPERS ───────────────────────────────────────────────
  function showMsg(el, msg) {
    if (!el) return
    el.textContent = msg
    el.style.display = ''
  }

  init()

})()
