/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        sans: ['DM Sans', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        appBg:           'var(--bg-primary)',
        appCard:         'var(--bg-secondary)',
        appInput:        'var(--bg-tertiary)',
        appNav:          'var(--bg-nav)',
        appBorder:       'var(--border-color)',
        appBorderLight:  'var(--border-light)',
        appText:         'var(--text-primary)',
        appTextMuted:    'var(--text-muted)',
        appTextDisabled: 'var(--text-disabled)',
      },
    },
  },
  plugins: [],
}
