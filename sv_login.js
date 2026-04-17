// ============================================================
// SAMEN VEERKRACHTIG — Login pagina v2
// Plak dit in: Webflow → Page Settings → Before </body>
//
// WEBFLOW STRUCTUUR NODIG:
//
//   Form Block
//     └── Form  [data-sv="magic-form"]
//           ├── Div  [data-sv="magic-fields"]    ← wrapper om input + knop
//           │     ├── Input (email)  [data-sv="magic-email"]
//           │     └── Button (submit) → "Stuur magic link"
//           ├── Div  [data-sv="magic-success"]   display:none
//           └── Div  [data-sv="magic-error"]     display:none
// ============================================================

(function () {

  // Als al ingelogd → doorsturen
  async function checkAuth() {
    const { data: { session } } = await sv.auth.getSession()
    if (session?.user) {
      const params   = new URLSearchParams(window.location.search)
      const redirect = params.get('redirect') || '/account/mijn-profiel'
      window.location.href = redirect
    }
  }

  checkAuth()

  // ── MAGIC LINK FORM ───────────────────────────────────────
  const form      = document.querySelector('[data-sv="magic-form"]')
  const successEl = document.querySelector('[data-sv="magic-success"]')
  const errorEl   = document.querySelector('[data-sv="magic-error"]')

  if (!form) {
    console.warn('[SV] data-sv="magic-form" niet gevonden')
    return
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault()
    e.stopPropagation()

    const emailInput = document.querySelector('[data-sv="magic-email"]')
    const fieldsEl   = document.querySelector('[data-sv="magic-fields"]')
    const btn        = form.querySelector('button[type="submit"]')
    const email      = emailInput?.value.trim().toLowerCase()

    if (!email || !email.includes('@')) {
      show(errorEl, 'Vul een geldig e-mailadres in.')
      return
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Versturen...' }
    hide(successEl)
    hide(errorEl)

    const { error } = await sv.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: 'https://samenveerkrachtig.webflow.io/account/mijn-profiel'
      }
    })

    if (error) {
      if (btn) { btn.disabled = false; btn.textContent = 'Stuur magic link' }
      show(errorEl, 'Er ging iets mis: ' + error.message)
    } else {
      // ✅ Formulier verbergen en success tonen
      if (fieldsEl) fieldsEl.style.display = 'none'
      show(successEl, 'Check je e-mail — we hebben een inloglink gestuurd naar ' + email)
    }
  })

  // ── HELPERS ───────────────────────────────────────────────
  function show(el, msg) {
    if (!el) return
    if (msg) el.textContent = msg
    el.style.display = ''
  }
  function hide(el) {
    if (el) el.style.display = 'none'
  }

})()
