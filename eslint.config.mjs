import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    '.next/**',
    '.next-*/**',
    '.deploy/**',
    'out/**',
    'build/**',
    'coverage/**',
    'dist/**',
    'next-env.d.ts',
  ]),
  {
    rules: {
      // 这些现有组件通过 Effect 同步浏览器状态，升级框架时先保持原有行为。
      'react-hooks/set-state-in-effect': 'off',
      // 图谱组件在渲染期间读取模拟布局快照，后续可单独重构为 state。
      'react-hooks/refs': 'off',
    },
  },
  {
    files: ['scripts/**/*.{js,ts}'],
    rules: {
      // 运维脚本由 Node.js 直接执行，现阶段继续使用 CommonJS require。
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);

export default eslintConfig;
