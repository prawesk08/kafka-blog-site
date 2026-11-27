# kafka.blog off Blogger: handoff (2026-11-27)

## Where things stand

- New site: Astro static build served by a Cloudflare Worker, repo `prawesk08/kafka-blog-site`.
- Preview: https://kafka-blog-site.lensandflares.workers.dev (Worker `kafka-blog-site`, Cloudflare account of lensandflares).
- kafka.blog itself still runs on Blogger. Nothing about the live site or DNS has changed.
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
4. Cutover (only after "ship it"): add `www.kafka.blog` and `kafka.blog` as Custom Domains on the Worker, which replaces the Blogger CNAME records. Then add the site in AdSense and check `/ads.txt`.
5. Keep the Blogger blog. Post photos are hosted on `blogger.googleusercontent.com` and stop working if it is deleted.
6. Rollback after cutover: remove the Worker custom domains and put back the Blogger DNS records (`www` CNAME `ghs.google.com`, plus the apex A records Blogger lists).
