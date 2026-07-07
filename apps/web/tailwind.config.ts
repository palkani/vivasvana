import type { Config } from 'tailwindcss';
import preset from '@vivasvana/config/tailwind.preset';
import animate from 'tailwindcss-animate';

const config: Config = {
  presets: [preset],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  plugins: [animate],
};

export default config;
