# Samen Veerkrachtig — Scripts

Scripts voor de Samen Veerkrachtig Webflow site.

## Gebruik in Webflow

### Project Settings → Before </head> (sitewide — laadt op elke pagina)
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" defer></script>
<script src="https://cdn.jsdelivr.net/gh/Hubrand/samenveerkrachtig@main/sv_sitewide.js" defer></script>
<script src="https://cdn.jsdelivr.net/gh/Hubrand/samenveerkrachtig@main/sv_autocomplete.js" defer></script>
```
> De Supabase client moet vóór sv_sitewide.js geladen worden. Met `defer` worden scripts in volgorde uitgevoerd.
> sv_autocomplete.js initialiseert zichzelf alleen als [data-sv="search-input"] aanwezig is op de pagina.

### Per pagina in Page Settings → Before </body>

| Pagina | Script |
|---|---|
| /forum | sv_forum_overzicht.js |
| /forum/onderwerp | sv_forum_onderwerp.js |
| /forum/onderwerp-detail | sv_forum_detail.js |
| /forum/nieuw-bericht | sv_nieuw_topic.js |
| /account/login | sv_login.js |
| /account/mijn-profiel | sv_profiel.js |

## jsDelivr cache
Na een push duurt het tot 24 uur voordat jsDelivr de nieuwe versie serveert.
Gebruik een specifieke commit hash voor directe updates:
`https://cdn.jsdelivr.net/gh/Hubrand/samenveerkrachtig@COMMIT_HASH/sv_forum_overzicht.js`
