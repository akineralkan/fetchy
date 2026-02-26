/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dynamic theme colors - these work with both light and dark modes
        'fetchy-bg': 'var(--bg-color, #1a1a24)',
        'fetchy-sidebar': 'var(--sidebar-color, #181e2e)',
        'fetchy-card': 'var(--card-color, #172040)',
        'fetchy-accent': 'var(--accent, #906070)',
        'fetchy-accent-hover': 'var(--accent-hover, #7a5060)',
        'fetchy-text': 'var(--text-color, #d8d8d8)',
        'fetchy-text-muted': 'var(--text-muted, #909090)',
        'fetchy-border': 'var(--border-color, #26263a)',
        'fetchy-tab-bar': 'var(--tab-bar-bg, #181e2e)',
        'fetchy-tab-active': 'var(--tab-active-bg, #1a1a24)',
        'fetchy-dropdown': 'var(--dropdown-bg, #181e2e)',
        'fetchy-modal': 'var(--modal-bg, #172040)',
        'fetchy-tooltip': 'var(--tooltip-bg, #1a1a24)',
        'fetchy-separator': 'var(--separator-color, #303045)',
        'fetchy-success': 'var(--success, #6a9878)',
        'fetchy-warning': 'var(--warning, #a08848)',
        'fetchy-error': 'var(--error, #a06060)',
        'fetchy-info': '#6080b0',

        // Light mode specific colors (fallback)
        'fetchy-bg-light': '#e6e6e9',
        'fetchy-sidebar-light': '#ededf0',
        'fetchy-card-light': '#f2f2f5',
        'fetchy-accent-light': '#8a5060',
        'fetchy-accent-hover-light': '#7a4050',
        'fetchy-text-light': '#2a2a2a',
        'fetchy-text-muted-light': '#5a5f66',
        'fetchy-border-light': '#c8ccce',
        'fetchy-success-light': '#458856',
        'fetchy-warning-light': '#987028',
        'fetchy-error-light': '#8a5050',
        'fetchy-info-light': '#4060a0',
      },
    },
  },
  plugins: [],
}



