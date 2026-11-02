const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ogSource = 'C:/Users/MR/.gemini/antigravity-ide/brain/f1e2d690-129e-484d-b57d-330dc819890d/cafelens_og_preview_1793639438108.jpg';
const iconSource = 'C:/Users/MR/.gemini/antigravity-ide/brain/f1e2d690-129e-484d-b57d-330dc819890d/cafelens_app_icon_1793639531232.jpg';
const publicDir = path.resolve(__dirname, '../public');

async function main() {
  console.log('Processing OG image for social previews...');
  // 1200x630 OpenGraph image
  await sharp(ogSource)
    .resize(1200, 630, { fit: 'cover' })
    .jpeg({ quality: 92 })
    .toFile(path.join(publicDir, 'og-image.jpg'));

  await sharp(ogSource)
    .resize(1200, 630, { fit: 'cover' })
    .png({ quality: 90 })
    .toFile(path.join(publicDir, 'og-image.png'));

  console.log('Processing Icons & Favicons...');
  // Apple touch icon (180x180)
  await sharp(iconSource)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // Favicon 32x32 PNG
  const p32 = await sharp(iconSource)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));

  // Favicon 16x16 PNG
  const p16 = await sharp(iconSource)
    .resize(16, 16)
    .png()
    .toFile(path.join(publicDir, 'favicon-16x16.png'));

  // Simple clean .ico file generated from 32x32 PNG buffer
  // Standard ICO header + 32x32 PNG image
  const png32Buffer = await sharp(iconSource).resize(32, 32).png().toBuffer();
  
  // Create valid ICO file format with PNG payload
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0); // Reserved
  icoHeader.writeUInt16LE(1, 2); // Type 1 = ICO
  icoHeader.writeUInt16LE(1, 4); // 1 image

  const icoEntry = Buffer.alloc(16);
  icoEntry.writeUInt8(32, 0); // width
  icoEntry.writeUInt8(32, 1); // height
  icoEntry.writeUInt8(0, 2);  // color palette
  icoEntry.writeUInt8(0, 3);  // reserved
  icoEntry.writeUInt16LE(1, 4); // color planes
  icoEntry.writeUInt16LE(32, 6); // bits per pixel
  icoEntry.writeUInt32LE(png32Buffer.length, 8); // image size
  icoEntry.writeUInt32LE(22, 12); // image offset (6 + 16 = 22)

  const icoBuffer = Buffer.concat([icoHeader, icoEntry, png32Buffer]);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);

  // Also create a crisp SVG favicon
  const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f5dfb8"/>
      <stop offset="50%" stop-color="#d4a373"/>
      <stop offset="100%" stop-color="#b07d48"/>
    </linearGradient>
    <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#231a14"/>
      <stop offset="100%" stop-color="#120c08"/>
    </radialGradient>
  </defs>
  <rect width="100" height="100" rx="22" fill="url(#bgGrad)"/>
  <circle cx="50" cy="50" r="42" fill="none" stroke="url(#goldGrad)" stroke-width="3"/>
  <!-- Aperture Blades -->
  <g stroke="url(#goldGrad)" stroke-width="2.5" fill="none" stroke-linecap="round">
    <path d="M50 14 L75 32" />
    <path d="M75 32 L82 62" />
    <path d="M82 62 L62 84" />
    <path d="M62 84 L32 80" />
    <path d="M32 80 L18 55" />
    <path d="M18 55 L32 24" />
    <path d="M32 24 L50 14" />
  </g>
  <!-- Coffee Bean & Steam Center -->
  <ellipse cx="50" cy="52" rx="10" ry="14" fill="url(#goldGrad)"/>
  <path d="M50 38 Q46 52 50 66" stroke="#120c08" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M47 34 Q45 28 48 24" stroke="url(#goldGrad)" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M53 34 Q55 28 52 24" stroke="url(#goldGrad)" stroke-width="1.8" fill="none" stroke-linecap="round"/>
</svg>`;

  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgFavicon, 'utf8');

  console.log('Successfully generated all branding assets in public/ directory!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
