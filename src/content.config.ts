import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

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
      ])
      .default('learning'),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { notes };
