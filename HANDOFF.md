# kafka.blog off Blogger: handoff (2026-11-27)

## LIVE since 2026-11-27 ~15:45 UTC (owner said "ship it")

- `www.kafka.blog` and `kafka.blog` are Custom Domains on the Worker `kafka-blog-site` (Cloudflare dashboard > Workers > kafka-blog-site > Domains). Public DNS (Cloudflare and Google resolvers) already returns Cloudflare addresses.
- Cloudflare Redirect Rule "Bare domain to www": `https://kafka.blog/*` -> `https://www.kafka.blog/${1}`, 301.
- `ads.txt` now serves the AdSense line (it was empty on Blogger).
- **Rollback (about 5 minutes):** Worker > Domains: remove both custom domains. DNS > add CNAME `www` -> `ghs.google.com` (DNS only) and four A records for `kafka.blog` (DNS only): 216.239.32.21, 216.239.34.21, 216.239.36.21, 216.239.38.21. Delete the redirect rule. Blogger keeps its own copy of everything.
- Blogger theme edits no longer change the public site. Change `theme/blogger-theme.xml` in this repo instead, or the Blogger copy and the live site drift apart.

## Where things stand

- New site: Astro static build served by a Cloudflare Worker, repo `prawesk08/kafka-blog-site`.
- Preview: https://kafka-blog-site.lensandflares.workers.dev (Worker `kafka-blog-site`, Cloudflare account of lensandflares).
- (Superseded: kafka.blog now runs on this site, see the LIVE section above.)
- Content: 139 posts and 18 pages from the Google Takeout of 2026-11-27, plus 6 draft posts and 1 draft page (`draft: true`, not published).
- Every URL in the live sitemaps (157) exists on the new site at the same path. Old WordPress `/YYYY/MM/DD/slug/` links still 301.
- Page structure was compared against live pages (post, homepage, label, archive, Books page): same markup apart from Blogger's own injected bits.

## Theme

- `theme/blogger-theme.xml` is a copy of the live Blogger theme. `npm run theme` compiles it.
- Current asset versions (match live as of 06:52 UTC): skin 188, core 235, ui 187, post 192, collections css 9 / js 10, audio-schema 4.
- **Until cutover, every change to the live Blogger theme must be repeated here.** Simplest: download the theme from Blogger again, replace `theme/blogger-theme.xml`, run `npm run theme`, commit.
- On preview hosts the page fetches assets/audio through `/__proxy/` because `assets.kafka.blog` only allows `www.kafka.blog` (CORS). On www.kafka.blog nothing is proxied.

## Decisions

- Comments: skipped (owner, 2026-11-27). No comment form. The 27 old Blogger comments show on the posts that have them.
- Hosting: Worker with static assets, not Pages, because Pages strips `.html` from URLs.

## Open items

1. Cloudflare build is disconnected from GitHub. Reconnect in Worker > Settings > Builds > Manage (GitHub asks the owner to confirm by email). Until then, start builds from the Builds page with "Retry build" (it builds the newest commit of the production branch).
2. Editor at `/admin/` (Decap): needs a GitHub OAuth App (callback `https://<site>/api/callback`) and Worker secrets `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`. Decap commits to `main`, so merge the PR first.
3. After merging to `main`, change the Worker's production branch from `astro-migration` to `main`.
4. Cutover: DONE 2026-11-27. Still to do after it: AdSense > Sites, make sure `kafka.blog` is listed/approved for the new host, and Search Console: keep the property, resubmit `sitemap.xml` and `sitemap-pages.xml`.
5. Keep the Blogger blog. Post photos are hosted on `blogger.googleusercontent.com` and stop working if it is deleted.
6. Rollback after cutover: remove the Worker custom domains and put back the Blogger DNS records (`www` CNAME `ghs.google.com`, plus the apex A records Blogger lists).
