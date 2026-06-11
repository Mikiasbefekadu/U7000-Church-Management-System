/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Core structural colors
        sidebar: {
          DEFAULT: '#1E3A5F',
          hover:   '#2D5282',
          active:  '#2B6CB0',
        },
        navy: {
          DEFAULT: '#243447',
          deep:    '#1a2332',
        },
        // Accent / brand
        gold: {
          DEFAULT: '#C9A227',
          light:   '#FFF8E1',
        },
        // Semantic status colors (mirrors CSS vars)
        primary: {
          DEFAULT: '#2B6CB0',
          light:   '#EBF4FF',
        },
        success: {
          DEFAULT: '#276749',
          light:   '#E6F4EF',
        },
        danger: {
          DEFAULT: '#C53030',
          light:   '#FFF5F5',
        },
        warning: {
          DEFAULT: '#B7791F',
          light:   '#FFFBEB',
        },
      },
      fontFamily: {
        sans:  ['"DM Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Fraunces"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
