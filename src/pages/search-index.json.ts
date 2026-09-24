import { getNotes, noteUrl } from '../lib/notes';
export async function GET() {
  const notes = await getNotes();
  return Response.json(
    notes.map((note) => ({
      title: note.data.title,
      description: note.data.description,
      category: note.data.category,
      tags: note.data.tags,
      body: note.body || '',
      url: noteUrl(note),
    })),
  );
}
