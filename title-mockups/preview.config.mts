import { defineConfig, mergeConfig } from 'vitest/config';
import base from '/home/user/SMBC/vite.config';
export default mergeConfig(
  base,
  defineConfig({
    root: '/home/user/SMBC',
    test: {
      include: ['*.preview.ts'],
      dir: '/tmp/claude-0/-home-user-SMBC/ed1be232-9526-5dbb-b2cc-de87896d1401/scratchpad/title-mockups',
    },
  }),
);
