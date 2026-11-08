/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("./src/design/tailwind-preset.cjs")],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
};
