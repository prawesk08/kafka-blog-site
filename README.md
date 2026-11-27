# kafka.blog

The Kafkaintherun blog as a static Astro site served by a Cloudflare Worker (static assets + a small Worker).

- `theme/blogger-theme.xml` is the Blogger theme the site was built from. `npm run theme` compiles it into
  `src/layouts/Theme.astro` (head, header, nav, sidebar, footer, every inline script, per-post SEO blocks).
- `src/components/Widget.astro` and `BlogPost.astro` rebuild Blogger's widgets (post lists, post page, archive, labels).
- `src/data/posts.json`, `pages.json` hold the posts. `npm run import -- feed.atom` re-imports a Google Takeout Blogger export.
- Styles and scripts still come from `assets.kafka.blog` (repo `kafka-blog-assests`), films and audio from `audio.kafka.blog`.
- `worker/index.js` serves Blogger URLs unchanged (`/2025/05/manusi.html`), label and search pages, archive pages,
  and Blogger-compatible feeds (`/feeds/posts/default`, `?alt=json`, `/-/Label`, `?alt=rss`) that the theme scripts read.

## Build and run

    npm install
    npm run build        # astro build + feeds, sitemaps, robots.txt, ads.txt
    npx wrangler dev     # local preview on http://localhost:8787
    npx wrangler deploy  # deploy (Cloudflare Workers Builds does this on every push to main)
