# kafka.blog handoff (state at v121, 28 Nov 2026, ~02:25 ET)

## Who and what
Prabesh (pen name बासभ) runs kafka.blog, a bilingual Nepali/English blog. Work this session: phone layout fixes, SEO, content. He reviews on a phone (390px emulation) and mostly wants phone fixes. **Desktop (>=1101px) stays untouched unless he asks.** The books/music/songs/photos pages' special layouts are left alone. Nepali text must be standard Nepali, never Hindi (see the basabh-writing-style skill).

## Architecture
- Site: Astro build on the Cloudflare Worker `kafka-blog-site`. Repo `prawesk08/kafka-blog-site`, branch `astro-migration`.
- Assets: repo `prawesk08/kafka-blog-assests` (sic), branch `main`, served at assets.kafka.blog. Files: `kafka-collections.css/js` (main), `kafka-core.js`, `kafka-skin-v187.css`.
- Site pages load `kafka-collections.css?v=N`, `kafka-collections.js?v=N` and `kafka-core.js?v=N` from `src/layouts/Theme.astro` and `theme/blogger-theme.xml`. **Current live: collections v121, core v242.**
- Content: `content/pages/*.html` (303 pages; 284 item pages: album-, song-, book-, movie-, show-) and `content/posts/YYYY/MM/*.html` (145), YAML front matter.
- Media at build time: `scripts/media-data.mjs` reads `https://audio.kafka.blog/video-manifest.json` (64 entries), `https://audio.kafka.blog/manifest.json` (139 audio entries), `https://assets.kafka.blog/video-captions.json` (4 entries) and writes VideoObject/AudioObject JSON-LD and the video sitemap.

## Release flow (every change)
1. Assets: branch from fresh `origin/main`, edit, commit, push, PR, squash-merge:
   `gh api repos/prawesk08/kafka-blog-assests/pulls -f title -f head -f base=main -F body=@/tmp/b.md --jq .number`, `sleep 7`, `gh api -X PUT .../pulls/N/merge -f merge_method=squash --jq .merged`.
2. Site: branch from `origin/astro-migration`, bump versions with
   `sed -i -E 's/kafka-collections\.(css|js)\?v=[0-9]+/kafka-collections.\1?v=N/g'` on `src/layouts/Theme.astro` and `theme/blogger-theme.xml` (and `kafka-core.js?v=` if core.js changed), PR with base `astro-migration`, squash-merge.
3. **Cloudflare builds are manual.** Navigate browser `tab-1` to `https://dash.cloudflare.com/d107ebca5418feda405015e23acd3954/workers/services/view/kafka-blog-site/production/builds`, wait ~8s, click (653,385) (latest build), then click Retry (708,197). Build takes ~2.5 min. Do not retrigger while one is running. Always use tabId `tab-1`.
4. Verify live: `fetch('/',{cache:'no-store'})` and regex `kafka-collections\.css\?v=(\d+)`.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01Y3RswAiMfSyrxzWFEmmAk5`; PR bodies end with the Claude Code line plus the session URL.
- The "unpushed commits on branch hsNNN" stop-hook message is a false positive after squash merges (verify with `git ls-remote`).

## CSS and JS gotchas
- Cross-origin stylesheets can't be inspected from the page, so debugging by `document.styleSheets` fails. Test by injecting a `<style>` and by evaluating unmerged JS fetched from raw.githubusercontent by commit SHA.
- Old rules use `html body <sel>` plus many `:not(#kzN)` terms with `!important`. Newer blocks use `:not(#kz1)..:not(#kz1300)`. Some old rules have 2000+ ids, so when CSS loses, **set inline styles from JS with `setProperty(k,v,'important')`** (used for v117, v120, v121).
- Some rules are injected by `kafka-core.js` (dock and share rail rules with `#kz,#kz2`; one inline rule with 8 ids sets `left:0;width:50%` on `.kdock`).
- The browser tool's `javascript_tool` evaluates the last expression (no `return`). The `seed` tab is shared with the user. Reset viewport emulation with `resize_window` preset "desktop" when done (currently emulating 390x844).

## Done this session (all live at v121 unless noted)
- Language switcher (All | नेपाली | English): restyled, hidden on single-language pages, series pages and (v119) shelf pages such as Literature; works on Science/History.
- Menu labels English; header "Collection/Category" spacing; tile right side shows a description and language chip; phone footer on one line.
- Hover panel ("What you'll find"): v121 makes the featured image the canvas on every tile, row and series part, with a dark veil and centred white text. Series rows `ol.kser-items>li` get a panel and open on one tap (v117).
- One tap or click opens any tile (v112).
- "Where to start" on home: loads 12 posts on phone and scrolls sideways, 3 rows x 2 columns (v113); the site JS fetches `matchMedia('(max-width:640px)') ? 12 : 5`.
- Featured & pinned: more air, Featured card leads, series card quieter (v114, `.kx-fp` rules).
- Floating bars on posts (v115/v116): audio player on the left edge and share on the right, small, vertical, translucent (opacity .5, full on touch). The audio pill follows the narrated spot (`placeDock` in `kafka-core.js`, v116).
- Bio chips (v118): Immunotherapy · Molecular Biology · Evolution above; Occasional Writer · Occasional Photographer below; equal-width rows (markup in `Theme.astro`, two places, and in `blogger-theme.xml`).
- Justified switch groups (v120): `.kord`, `.klsw`, `.kctl` span full width with equal buttons at max-width 1100px (inline styles from JS).
- SEO: unique descriptions, social text and keywords for all 284 item pages (`tools/seo_items.py`); cross-links between item pages and posts (`tools/xlink.py`, 21 item pages and 12 posts); 7 sourced quotes (`tools/quote_candidates.json` holds 10 more); Nepali descriptions and Devanagari keywords for 20 Nepali books and 2 songs (`tools/ne_desc.py`, run after `seo_items.py`). Not yet re-verified live: the Nepali paragraph on `/p/book-naso.html` (`class="kpg-ne"`).

## To do / waiting
1. **Videos.** Manifest unchanged since 00:47 UTC; all 64 resolve and have VideoObject. The user said updates were paused and will say when they are running. Then: rebuild, check each new post (VideoObject, og:video, sitemap). About 62 posts have no film (mostly the Nepali twins of the Sumer, Roman Britannia, cancer, smallpox and organism essays). Gemini's "60/64" count is unreconciled.
2. **YouTube and Spotify links per post:** blocked, need the video/playlist IDs and episode URLs. Then add to post markup and structured data (sameAs, PodcastEpisode, VideoObject).
3. Verify live: Nepali paragraph on `/p/book-naso.html`; The Birds quote on its item page (the other six were live).
4. Optional: IndexNow or Search Console sitemap submission checklist; more cross-links; public-domain book quotes (Gutenberg is blocked for WebFetch); offer softer shade for faded-red section titles (no answer yet); iPad (701-1100) layout check; remaining accessibility items.
5. Possible extra: justify the scrolling chip rows (Literature shelves, Science topics) only if he asks; they were deliberately left scrolling.
