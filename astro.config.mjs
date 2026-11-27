import { defineConfig } from 'astro/config';

// Pages are written as real files (2025/05/manusi.html, p/books.html) so every Blogger URL keeps working
// unchanged. The Worker in worker/index.js serves them with html_handling "none" (no .html redirects).
export default defineConfig({
  site: 'https://www.kafka.blog',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'file', inlineStylesheets: 'never' },
  compressHTML: false,
});
