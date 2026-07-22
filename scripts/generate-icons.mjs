import sharp from "sharp";
import { mkdirSync } from "node:fs";

const INK = "#15181E";
const ACCENT = "#FFD338";
const BG = "#FFFFFF";

// Contenu centré dans un carré de sécurité de 80% (zone maskable) : un cadenas
// simple et bold, lisible même à 48px sur un écran d'accueil.
function iconSvg({ background, safeZonePadding }) {
  const size = 512;
  const pad = safeZonePadding ? size * 0.1 : 0;
  const contentSize = size - pad * 2;
  const scale = contentSize / 512;
  const shackleColor = background === INK ? BG : INK;

  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${background}" />
  <g transform="translate(${pad}, ${pad}) scale(${scale})">
    <path d="M180 246v-66a76 76 0 0 1 152 0v66" stroke="${shackleColor}" stroke-width="34" stroke-linecap="round" fill="none" />
    <rect x="146" y="240" width="220" height="180" rx="28" fill="${ACCENT}" />
    <circle cx="256" cy="320" r="18" fill="${INK}" />
    <rect x="246" y="330" width="20" height="34" rx="6" fill="${INK}" />
  </g>
</svg>`;
}

mkdirSync("public/icons", { recursive: true });

async function render(name, svg, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/icons/${name}`);
  console.log(`wrote public/icons/${name}`);
}

const opaque = iconSvg({ background: INK, safeZonePadding: false });
const maskable = iconSvg({ background: INK, safeZonePadding: true });
const favicon = iconSvg({ background: BG, safeZonePadding: false });

await render("icon-192.png", opaque, 192);
await render("icon-512.png", opaque, 512);
await render("maskable-192.png", maskable, 192);
await render("maskable-512.png", maskable, 512);
await render("apple-touch-icon.png", opaque, 180);
await render("favicon-32.png", favicon, 32);

console.log("done");
