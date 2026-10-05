import { createHash } from 'node:crypto';
import { getNotes, href, type Note } from './notes';

export type PaperMetadata = NonNullable<Note['data']['paper']>;
export type Paper = Note & {
  data: Note['data'] & { paper: PaperMetadata };
};

export const getPapers = async (): Promise<Paper[]> =>
  (await getNotes()).filter(
    (note): note is Paper => note.data.paper !== undefined,
  );

export const paperUrl = (paper: Paper) => href(`papers/${paper.id}/`);
export const questionRevision = (questions: PaperMetadata['questions']) =>
  createHash('sha256')
    .update(JSON.stringify(questions))
    .digest('hex')
    .slice(0, 16);
export { href, formatDate } from './notes';
