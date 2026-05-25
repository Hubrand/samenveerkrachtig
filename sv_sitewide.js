window.sv = window.supabase.createClient(
  'https://vavwwyelfyvijumgmemi.supabase.co',
  'sb_publishable_MAqf_d6Xo4nv4RR7JuOerw_vKXAvRi5'
)
window.svUser    = undefined  // undefined = nog aan het laden, null = uitgelogd
window.svProfile = null

async function svInit() {
  const { data: { session } } = await sv.auth.getSession()

  if (session) {
    window.svUser = session.user

    const { data: profile } = await sv
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    window.svProfile = profile

    svShow('logged-in')
    svHide('logged-out')
    svHide('loading')
    svFill('username', profile?.display_name || session.user.email.split('@')[0])

    if (profile?.avatar_url) {
      document.querySelectorAll('[data-sv="avatar"]')
        .forEach(el => el.src = profile.avatar_url)
    }

    if (profile?.is_admin || profile?.is_moderator) {
      svShow('admin-only')
    }

    // ✅ Nieuw account zonder naam → doorsturen naar profiel met welkomstbericht
    const isLoginPage = window.location.pathname === '/account/login'
    if (!profile?.display_name && !isLoginPage) {
      window.location.href = '/account/mijn-profiel?welkom=1'
    }

  } else {
    window.svUser = null
    svHide('logged-in')
    svShow('logged-out')
    svHide('loading')
    svHide('admin-only')
  }

  // ✅ Logout-knoppen binden (overal op de site)
  document.querySelectorAll('[data-sv="logout"]').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault()
      svLogout()
    })
  })

  // ✅ Auth klaar — andere scripts kunnen nu veilig window.svUser lezen
  window.dispatchEvent(new Event('sv:auth-ready'))
}

// Uitloggen
window.svLogout = async function() {
  await sv.auth.signOut()
  window.location.href = '/forum'
}

// Helpers
window.svShow = function(val) {
  document.querySelectorAll('[data-sv="' + val + '"]')
    .forEach(el => el.style.display = '')
}
window.svHide = function(val) {
  document.querySelectorAll('[data-sv="' + val + '"]')
    .forEach(el => el.style.display = 'none')
}
window.svFill = function(val, text) {
  document.querySelectorAll('[data-sv="' + val + '"]')
    .forEach(el => el.textContent = text)
}
window.svQ = function(parent, val) {
  return parent.querySelector('[data-sv="' + val + '"]')
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', svInit)
} else {
  svInit()
}
