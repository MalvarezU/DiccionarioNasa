import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-public-sans)'],
        serif: ['var(--font-newsreader)'],
        mono: ['var(--font-public-sans)'],
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
export default config;
