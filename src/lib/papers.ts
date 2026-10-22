import { createHash } from 'node:crypto';
import { getNotes, noteUrl, type Note } from './notes';

export type PaperMetadata = NonNullable<Note['data']['paper']>;
export type Paper = Note & {
  data: Note['data'] & { paper: PaperMetadata };
};
export type StudyPaperMetadata = Extract<PaperMetadata, { mode: 'study' }>;
export type StudyPaper = Note & {
  data: Note['data'] & { paper: StudyPaperMetadata };
};

export const getPapers = async (): Promise<Paper[]> =>
  (await getNotes()).filter(
    (note): note is Paper => note.data.paper !== undefined,
  );

export const getStudyPapers = async (): Promise<StudyPaper[]> =>
  (await getPapers()).filter(
    (paper): paper is StudyPaper => paper.data.paper.mode === 'study',
  );

export const paperUrl = (paper: Paper) => noteUrl(paper);
export const questionRevision = (questions: StudyPaperMetadata['questions']) =>
  createHash('sha256')
    .update(JSON.stringify(questions))
    .digest('hex')
    .slice(0, 16);
export { href, formatDate } from './notes';
