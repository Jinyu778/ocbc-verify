/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("./src/design/tailwind-preset.cjs")],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // hover: styles only apply on devices that can really hover (no "stuck" hover after a tap)
  future: { hoverOnlyWhenSupported: true },
};
