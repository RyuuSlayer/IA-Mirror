/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'ia-bg': '#FFFFFF',
        'ia-text': '#333333',
        'ia-link': '#2C2C2C',
        'ia-link-hover': '#000000',
        'ia-border': '#ddd',
        'ia-gray': {
          100: '#f8f8f8',
          200: '#e8e8e8',
          300: '#dddddd',
          400: '#999999',
          500: '#666666',
        },
        'archive-blue': '#428BCA',
      },
    },
  },
  plugins: [],
}
