import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bone: "#FFFFFF",
        ink: "#111111",
        clay: "#C58348",
        sage: "#4D654E",
        mocha: "#222222",
        cream: "#F5F5F7",
        terracotta: "#C58348",
        // White & Black foundation
        brand: {
          white: "#FFFFFF",
          black: "#111111",
          surface: "#F5F5F7",
          border: "#E5E5E7",
          muted: "#666666",
        },
        // Segment Accent Colors
        shop: {
          DEFAULT: "#C58348",
          hover: "#AE703A",
          tint: "#FAF3EB",
        },
        kitchen: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
          tint: "#EFF6FF",
        },
        room: {
          DEFAULT: "#4D654E",
          hover: "#3D523E",
          tint: "#F0F4F0",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out",
        "slide-up": "slideUp 0.7s ease-out",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
