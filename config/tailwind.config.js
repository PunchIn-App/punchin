/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Noto Sans Display"', '"Noto Sans"', 'sans-serif'],
        sans: ['"Noto Sans"', 'sans-serif'],
        mono: ['"Noto Sans Mono"', 'monospace'],
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
        appTextDarker:   'var(--text-darker)',
        appTextDisabled: 'var(--text-disabled)',
        appTextPlaceholder: 'var(--text-placeholder)',
        appAccent:       'rgb(var(--accent-rgb) / <alpha-value>)',
        appOnAccent:     'var(--on-accent)',
      },
    },
  },
  plugins: [],
}
