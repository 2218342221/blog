export const site = {
  name: 'Clearer Notes',
  nameEn: 'Clearer Notes',
  author: 'Clearer Notes',
  title: 'Clearer Notes · 学习笔记',
  titleEn: 'Clearer Notes · Learning Journal',
  descriptionEn:
    'Notes, diagrams, and experiments for making sense of complex ideas.',
  description: '用笔记、图解和小实验，把复杂的想法慢慢弄清楚。',
  // GitHub Actions 会自动使用仓库的 Pages 地址；手动部署时在此填写域名。
  url: 'https://2218342221.github.io',
  github: 'https://github.com/2218342221/blog',
};

export const topics = [
  {
    id: 'system-design',
    label: '系统设计',
    labelEn: 'System Design',
    en: 'SYSTEM DESIGN',
    description: '从一个请求，到整个系统。',
    descriptionEn: 'From one request to a whole system.',
    cover: 'cache',
    color: 'mint',
  },
  {
    id: 'ai-engineering',
    label: 'AI 工程',
    labelEn: 'AI Engineering',
    en: 'AI ENGINEERING',
    description: '理解模型，也理解落地。',
    descriptionEn: 'Understand models. Build with them.',
    cover: 'rag',
    color: 'lavender',
  },
  {
    id: 'backend',
    label: '后端开发',
    labelEn: 'Backend Development',
    en: 'BACKEND DEVELOPMENT',
    description: '写出可靠、清晰的代码。',
    descriptionEn: 'Build clear, reliable software.',
    cover: 'api',
    color: 'peach',
  },
  {
    id: 'learning',
    label: '学习方法',
    labelEn: 'Learning to Learn',
    en: 'LEARNING IN PUBLIC',
    description: '让每一次学习都有回响。',
    descriptionEn: 'Make every lesson stay with you.',
    cover: 'learning',
    color: 'yellow',
  },
] as const;
