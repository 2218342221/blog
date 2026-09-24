import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { site } from '../config/site';
import { getNotes, noteUrl, href } from '../lib/notes';
export async function GET(context: APIContext) {
  const notes = await getNotes();
  return rss({
    title: site.title,
    description: site.description,
    site: new URL(href(), context.site || site.url),
    items: notes.map((note) => ({
      title: note.data.title,
      description: note.data.description,
      pubDate: note.data.published,
      link: noteUrl(note),
      categories: note.data.tags,
    })),
    customData: '<language>zh-cn</language>',
  });
}
