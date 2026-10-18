const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'asset-manifest.json'), 'utf8'));
const qa = JSON.parse(fs.readFileSync(path.join(root, 'qa.json'), 'utf8'));
const data = {};
for (const a of manifest.assets) {
  const bbox = qa.find(q=>q.id===a.id).bboxAlpha32;
  // Keep a small safety margin outside the measured visible contour.
  const crop = { x: Math.max(0,bbox[0]-12), y: Math.max(0,bbox[1]-12),
    right: Math.min(a.width,bbox[2]+12), bottom: Math.min(a.height,bbox[3]+12) };
  crop.width = crop.right-crop.x; crop.height = crop.bottom-crop.y;
  let sides;
  if (a.id.startsWith('button-')) sides = { x: .145, y: .37 };
  else if (a.id.startsWith('panel-')) sides = { x: .13, y: .16 };
  else if (a.id.startsWith('tab-')) sides = { x: .14, y: .47 };
  else sides = { x: .13, y: .29 };
  data[a.id] = { src:a.web, width:a.width, height:a.height, crop,
    slice: { left:Math.round(crop.width*sides.x),right:Math.round(crop.width*sides.x),
      top:Math.round(crop.height*sides.y),bottom:Math.round(crop.height*sides.y) } };
}
fs.writeFileSync(path.join(root,'component-assets.js'), 'window.SeasideAAssets = '+JSON.stringify(data,null,2)+';\n');
console.log('Generated measured layout data for '+Object.keys(data).length+' assets.');
