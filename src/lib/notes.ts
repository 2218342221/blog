import { getCollection, type CollectionEntry } from 'astro:content';

export type Note = CollectionEntry<'notes'>;
export const href = (path = '') =>
  `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
export const noteUrl = (note: Note) =>
  href(note.data.destination || `notes/${note.id}/`);
export const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai',
  })
    .format(date)
    .replaceAll('/', '.');
export const readingTime = (note: Note) => {
  const body = note.body || '';
  const chinese = (body.match(/[\u3400-\u9fff]/g) || []).length;
  const words = (
    body.replace(/[\u3400-\u9fff]/g, ' ').match(/\b[\w-]+\b/g) || []
  ).length;
  return Math.max(1, Math.ceil(chinese / 350 + words / 220));
};
export const getNotes = async () =>
  (await getCollection('notes', ({ data }) => !data.draft)).sort(
    (a, b) =>
      b.data.published.valueOf() - a.data.published.valueOf() ||
      a.id.localeCompare(b.id),
  );
