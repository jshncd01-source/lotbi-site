import {cp, mkdir, rm} from 'node:fs/promises';

const files = [
  'index.html', 'privacy.html', 'terms.html', 'account-deletion.html', 'contact.html',
  'styles.css', 'home-chat.css', 'site-hardening.css', 'home-shell.js',
  'robots.txt', 'sitemap.xml', 'CNAME',
];

await rm('dist', {recursive: true, force: true});
await mkdir('dist', {recursive: true});
for (const file of files) await cp(file, `dist/${file}`);
await cp('assets', 'dist/assets', {recursive: true});
