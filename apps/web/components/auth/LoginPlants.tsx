'use client';

/**
 * LoginPlants — quiet line-art sprigs sitting under the sign-in card, revealed
 * as the page scrolls (the Claude sign-in reference). Pure inline SVG so there
 * is no asset to ship and it inherits the theme through currentColor. The stroke
 * is the violet accent at low opacity, so it reads as a calm botanical detail in
 * both light and dark rather than a heavy graphic.
 */
export default function LoginPlants() {
  return (
    <div aria-hidden className="pointer-events-none w-full flex justify-center text-brand/40">
      <svg
        viewBox="0 0 360 120"
        className="w-full max-w-lg h-auto"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* centre sprout */}
        <path d="M180 118 V70" />
        <path d="M180 92 C168 90 160 80 158 68 C170 68 179 78 180 90" />
        <path d="M180 84 C192 82 200 72 202 60 C190 60 181 70 180 82" />
        <circle cx="180" cy="62" r="3.2" />

        {/* left sprig */}
        <path d="M108 118 V82" />
        <path d="M108 100 C99 99 93 92 92 83 C101 83 107 90 108 99" />
        <path d="M108 94 C117 93 123 86 124 77 C115 77 109 84 108 93" />

        {/* right sprig */}
        <path d="M252 118 V82" />
        <path d="M252 100 C261 99 267 92 268 83 C259 83 253 90 252 99" />
        <path d="M252 94 C243 93 237 86 236 77 C245 77 251 84 252 93" />

        {/* far-left seedling */}
        <path d="M52 118 V96" />
        <path d="M52 106 C46 105 42 100 41 94 C47 94 51 99 52 105" />

        {/* far-right seedling */}
        <path d="M308 118 V96" />
        <path d="M308 106 C314 105 318 100 319 94 C313 94 309 99 308 105" />
      </svg>
    </div>
  );
}
