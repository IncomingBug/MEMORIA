const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
const publicDir = path.join(root, "public");

console.log("Preparing static deployment bundle for Mode B...");
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

// Copy public directory contents recursively
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(publicDir, output);

// Copy root config assets needed for Firebase / static hosting
const rootAssets = ["firebase-config.js"];
for (const asset of rootAssets) {
  const src = path.join(root, asset);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(output, asset));
  }
}

const buildVersion = (process.env.GITHUB_SHA || Date.now().toString(36)).slice(0, 12);
const indexPath = path.join(output, "index.html");
const indexHtml = fs.readFileSync(indexPath, "utf8").replace(
  /((?:src|href)=")(?!https?:|\/\/)([^"]+\.(?:css|js))"/g,
  (_, attribute, asset) => `${attribute}${asset}?v=${buildVersion}"`
);
fs.writeFileSync(indexPath, indexHtml);

// GitHub Pages no-jekyll marker
fs.writeFileSync(path.join(output, ".nojekyll"), "");
console.log(`Static MEMORIA v2 bundle created successfully in ${path.relative(root, output)}.`);
