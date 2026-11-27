import { posts } from './site.js';
// Blogger's post page links: "Previous" = the next older post, "Next" = the next newer post.
export function neighbours(post) {
  const i = posts.findIndex((p) => p.id === post.id);
  return { newer: i > 0 ? posts[i - 1] : null, older: i >= 0 && i < posts.length - 1 ? posts[i + 1] : null };
}
