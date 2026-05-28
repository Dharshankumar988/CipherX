const sharp = require('sharp');
const fs = require('fs');

async function generate() {
  const source = 'public/pwa-512x512.png'; // This is actually a 1024x1024 JPEG
  
  // 1. Generate 192x192 PNG
  await sharp(source)
    .resize(192, 192)
    .toFormat('png')
    .toFile('public/icon-192.png');
    
  // 2. Generate 512x512 PNG
  await sharp(source)
    .resize(512, 512)
    .toFormat('png')
    .toFile('public/icon-512.png');
    
  // 3. Generate 1280x720 Desktop Screenshot (Icon in center)
  const iconForDesktop = await sharp(source).resize(400, 400).toBuffer();
  await sharp({
    create: { width: 1280, height: 720, channels: 4, background: '#0A0D10' }
  })
    .composite([{ input: iconForDesktop, gravity: 'center' }])
    .toFormat('png')
    .toFile('public/screenshot-desktop.png');
    
  // 4. Generate 720x1280 Mobile Screenshot (Icon in center)
  const iconForMobile = await sharp(source).resize(300, 300).toBuffer();
  await sharp({
    create: { width: 720, height: 1280, channels: 4, background: '#0A0D10' }
  })
    .composite([{ input: iconForMobile, gravity: 'center' }])
    .toFormat('png')
    .toFile('public/screenshot-mobile.png');

  console.log('Successfully generated all required PWA PNG assets!');
}

generate().catch(console.error);
