import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const paperAsset = z
  .string()
  .regex(/^papers\/[a-z0-9-]+\/files\/[a-z0-9][a-z0-9.-]*$/);
const reviewQuestion = z
  .object({
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(5),
    correct: z.number().int().nonnegative(),
    explanation: z.string().min(1),
  })
  .refine((question) => question.correct < question.options.length, {
    message: '正确答案必须对应一个存在的选项（从 0 开始）',
    path: ['correct'],
  });

const paperMetadata = z.object({
  shortTitle: z.string().min(1),
  originalTitle: z.string().min(1),
  authors: z.array(z.string().min(1)).min(1),
  year: z.number().int().min(1900),
  version: z.string().min(1),
  sourceUrl: z.url(),
  codeUrl: z.url(),
  codeVersion: z.string().min(1),
  license: z.string().min(1),
  reportPages: z.number().int().min(1).max(3),
  readingMinutes: z.number().int().positive(),
  takeaway: z.string().min(1),
  assets: z.object({
    translationPdf: paperAsset,
    translationTex: paperAsset,
    sourceBundle: paperAsset,
    originalSource: paperAsset,
    originalPdf: paperAsset,
    reportPdf: paperAsset,
  }),
  questions: z.array(reviewQuestion).min(1),
});

const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    destination: z
      .string()
      .regex(/^[a-z0-9-]+(?:\/[a-z0-9-]+)*\/$/)
      .optional(),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    category: z.enum(['系统设计', 'AI 工程', '后端开发', '学习方法']),
    tags: z.array(z.string()).default([]),
    cover: z
      .enum([
        'cache',
        'rag',
        'api',
        'learning',
        'database',
        'transformer',
        'benchmark',
        'memory',
        'inference',
        'architecture',
        'engineering',
      ])
      .default('learning'),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    paper: paperMetadata.optional(),
  }),
});

export const collections = { notes };
