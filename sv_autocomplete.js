(function () {
  'use strict'

  var CONFIG = {
    edgeFunctionUrl: 'https://vavwwyelfyvijumgmemi.supabase.co/functions/v1/webflow-search',
    supabaseUrl:     'https://vavwwyelfyvijumgmemi.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdnd3eWVsZnl2aWp1bWdtZW1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Mzg3MjcsImV4cCI6MjA4OTMxNDcyN30.91HQOAju13k1Iaos4BNzD5GvD55nUyW6-NS2U9wOjgc',
    minQueryLength:      2,
    debounceMs:          280,
    maxResultsPerSource: 8,
    resultsPageUrl:      '/search',
  }

  var LABEL_STYLES = {
    'Kennisbank':  { border: '#97BAE6', bg: '#E7F2FF', hover: '#E7F2FF' },
    'Koffietafel': { border: '#F29278', bg: '#F7ECE8', hover: '#F7ECE8' },
    'Forum':       { border: '#ABD6A4', bg: '#EBF2EA', hover: '#EBF2EA' },
    'Nieuws':      { border: '#97BAE6', bg: '#E7F2FF', hover: '#E7F2FF' },
    'Begrip':      { border: '#97BAE6', bg: '#E7F2FF', hover: '#E7F2FF' },
    'Vacature':    { border: '#97BAE6', bg: '#E7F2FF', hover: '#E7F2FF' },
  }

  var input          = document.querySelector('[data-sv="search-input"]')
  var dropdown       = document.querySelector('[data-sv="search-dropdown"]')
  var resultTemplate = document.querySelector('[data-sv="search-result-template"]')
  var footerTemplate = document.querySelector('[data-sv="search-footer-template"]')

  if (!input || !dropdown) {
    console.warn('[SV Autocomplete] search-input of search-dropdown niet gevonden')
    return
  }

  // ── EDGE FUNCTION WARM HOUDEN ─────────────────────────────
  setTimeout(function() {
    fetch(CONFIG.edgeFunctionUrl + '?query=wia').catch(function(){})
  }, 1500)

  // ── FORM SUBMIT ONDERSCHEPPEN ─────────────────────────────
  var searchForm = input.closest('form')
  if (searchForm) {
    searchForm.addEventListener('submit', function (e) {
      e.preventDefault()
      e.stopPropagation()
      var val = input.value.trim()
      if (val) window.location.href = CONFIG.resultsPageUrl + '?queryuery=' + encodeURIComponent(val)
    }, true)
  }

  // ── DROPDOWN POSITIONERING — position:absolute ────────────
  // Geen fixed, geen body append — gewoon onder de input
  // De wrapper (form of parent) krijgt position:relative
  var wrapper = input.closest('form') || input.parentElement
  if (wrapper) wrapper.style.position = 'relative'

  dropdown.style.position   = 'absolute'
  dropdown.style.top        = '100%'
  dropdown.style.left       = '0'
  dropdown.style.width      = '100%'
  dropdown.style.zIndex     = '9999'
  dropdown.style.display    = 'none'
  dropdown.style.background = '#fff'
  dropdown.style.maxHeight  = '420px'
  dropdown.style.overflowY  = 'auto'
  dropdown.style.overflowX  = 'hidden'
  dropdown.style.boxShadow  = '0 8px 32px rgba(0,0,0,0.12)'
  dropdown.style.borderRadius = '0 0 12px 12px'
  dropdown.style.border     = '1px solid #e5e7eb'
  dropdown.style.borderTop  = 'none'

  var debounceTimer = null
  var activeQuery   = ''
  var currentIndex  = -1
  var cache         = {}

  // ── HELPERS ───────────────────────────────────────────────
  function esc(str) {
    return (str || '').replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }

  function highlight(text, query) {
    if (!query || !text) return esc(text || '')
    var re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi')
    return esc(text).replace(re, '<strong>$1</strong>')
  }

  function getLabelStyle(label) {
    return LABEL_STYLES[label] || { border: '#e5e7eb', bg: '#f9fafb', hover: '#f3f4f6' }
  }

  // ── DROPDOWN RENDEREN ─────────────────────────────────────
  function render(items, query) {
    currentIndex = -1
    dropdown.innerHTML = ''

    if (items.length === 0) {
      var empty = document.createElement('div')
      empty.style.cssText = 'padding:14px 16px;font-size:14px;opacity:.5;text-align:center'
      empty.textContent = 'Geen resultaten voor "' + query + '"'
      dropdown.appendChild(empty)
    } else {
      items.forEach(function(item, i) {
        var style = getLabelStyle(item.label)
        var el

        if (resultTemplate) {
          el = resultTemplate.cloneNode(true)
          el.removeAttribute('data-sv')
          el.style.display = ''
          el.href = item.url
          el.dataset.index = i
          el.dataset.hoverBg = style.hover

          var iconEl  = el.querySelector('[data-sv="result-icon"]')
          var labelEl = el.querySelector('[data-sv="result-label"]')
          var titleEl = el.querySelector('[data-sv="result-title"]')

          if (iconEl)  iconEl.textContent = item.icon
          if (titleEl) titleEl.innerHTML  = highlight(item.title, query)
          if (labelEl) {
            labelEl.textContent        = item.label
            labelEl.style.border       = '1px solid ' + style.border
            labelEl.style.background   = style.bg
            labelEl.style.borderRadius = '999px'
          }
        } else {
          el = document.createElement('a')
          el.href = item.url
          el.dataset.index = i
          el.dataset.hoverBg = style.hover
          el.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 16px;text-decoration:none;color:inherit;border-bottom:1px solid #f0f4f8;cursor:pointer;background:#fff'
          el.innerHTML =
            '<span style="font-size:14px;width:20px;text-align:center;flex-shrink:0">' + item.icon + '</span>' +
            '<span style="font-size:11px;font-weight:500;background:' + style.bg + ';border:1px solid ' + style.border + ';border-radius:999px;padding:2px 8px;white-space:nowrap;flex-shrink:0">' + esc(item.label) + '</span>' +
            '<span style="font-size:14px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0">' + highlight(item.title, query) + '</span>'
        }

        el.addEventListener('mouseenter', function() { currentIndex = i; updateActive() })
        dropdown.appendChild(el)
      })
    }

    // Footer
    var footer
    if (footerTemplate) {
      footer = footerTemplate.cloneNode(true)
      footer.removeAttribute('data-sv')
      footer.style.display = ''
      footer.href = CONFIG.resultsPageUrl + '?query=' + encodeURIComponent(query)
      var footerText = footer.querySelector('[data-sv="footer-text"]')
      if (footerText) {
        footerText.textContent = 'Bekijk alle resultaten voor "' + query + '"'
      } else {
        footer.textContent = 'Bekijk alle resultaten voor "' + query + '"'
      }
    } else {
      footer = document.createElement('a')
      footer.href = CONFIG.resultsPageUrl + '?query=' + encodeURIComponent(query)
      footer.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:11px 16px;font-size:14px;color:#031F3D;font-weight:600;text-decoration:none;border-top:1px solid #e0e7ef;background:#F9F7F6'
      footer.textContent = '→ Bekijk alle resultaten voor "' + query + '"'
    }
    dropdown.appendChild(footer)

    open()
  }

  function renderLoading() {
    dropdown.innerHTML = '<div style="padding:14px 16px;font-size:14px;opacity:.5;text-align:center">Zoeken…</div>'
    open()
  }

  function open()  { dropdown.style.display = 'block' }
  function close() { dropdown.style.display = 'none'; currentIndex = -1 }

  function updateActive() {
    dropdown.querySelectorAll('[data-index]').forEach(function(el, i) {
      el.style.background = i === currentIndex ? (el.dataset.hoverBg || '#f0f9f4') : ''
    })
  }

  // ── KEYBOARD NAVIGATIE ────────────────────────────────────
  input.addEventListener('keydown', function(e) {
    var items = dropdown.querySelectorAll('[data-index]')
    if (!items.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      currentIndex = Math.min(currentIndex + 1, items.length - 1)
      updateActive()
      items[currentIndex] && items[currentIndex].scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      currentIndex = Math.max(currentIndex - 1, -1)
      updateActive()
    } else if (e.key === 'Enter' && currentIndex >= 0) {
      e.preventDefault()
      items[currentIndex] && items[currentIndex].click()
    } else if (e.key === 'Escape') {
      close(); input.blur()
    }
  })

  // ── SLUITEN BIJ KLIK BUITEN ───────────────────────────────
  document.addEventListener('click', function(e) {
    if (!dropdown.contains(e.target) && e.target !== input) close()
  })

  // ── DATA OPHALEN ──────────────────────────────────────────
  async function fetchWebflowCMS(query) {
    if (cache['cms_' + query]) return cache['cms_' + query]
    try {
      var res = await fetch(
        CONFIG.edgeFunctionUrl + '?query=' + encodeURIComponent(query) + '&limit=' + CONFIG.maxResultsPerSource
      )
      if (!res.ok) return []
      var data = await res.json()
      var results = data.results || []
      cache['cms_' + query] = results
      return results
    } catch (err) {
      console.warn('[SV] Edge Function fout:', err)
      return []
    }
  }

  async function fetchForumTopics(query) {
    if (cache['forum_' + query]) return cache['forum_' + query]
    try {
      var url = CONFIG.supabaseUrl + '/rest/v1/topics?select=id,title,legacy_wp_slug&title=ilike.' +
        encodeURIComponent('%' + query + '%') + '&limit=' + CONFIG.maxResultsPerSource
      var res = await fetch(url, {
        headers: {
          'apikey':        CONFIG.supabaseAnonKey,
          'Authorization': 'Bearer ' + CONFIG.supabaseAnonKey,
        }
      })
      if (!res.ok) return []
      var topics = await res.json()
      var results = topics.map(function(topic) {
        return {
          title: topic.title || 'Forum bericht',
          url:   '/forum/onderwerp-detail?slug=' + (topic.legacy_wp_slug || topic.id),
          label: 'Forum',
          icon:  '💬',
        }
      })
      cache['forum_' + query] = results
      return results
    } catch (err) {
      console.warn('[SV] Supabase fout:', err)
      return []
    }
  }

  // ── ZOEKEN ────────────────────────────────────────────────
  async function search(query) {
    if (query.length < CONFIG.minQueryLength) { close(); return }
    activeQuery = query
    renderLoading()

    var results = await Promise.all([
      fetchWebflowCMS(query),
      fetchForumTopics(query),
    ])

    if (activeQuery !== query) return
    render(results[0].concat(results[1]), query)
  }

  // ── INPUT ─────────────────────────────────────────────────
  input.addEventListener('input', function() {
    var val = input.value.trim()
    clearTimeout(debounceTimer)
    if (val.length < CONFIG.minQueryLength) { close(); return }
    debounceTimer = setTimeout(function() { search(val) }, CONFIG.debounceMs)
  })

  input.addEventListener('focus', function() {
    if (input.value.trim().length >= CONFIG.minQueryLength) open()
  })

  console.log('[SV Autocomplete] ✅ Actief v11')

})()
