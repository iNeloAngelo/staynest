/**
 * Проверка относительных ссылок в markdown.
 *
 * Запуск: pnpm links:check  (или node scripts/check-links.mjs docs README.md)
 * Внешние ссылки не проверяются: для этого нужен сетевой запрос и устойчивость
 * к чужим 403/429. Здесь важно поймать битые пути к файлам репозитория.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const targets = process.argv.slice(2);
const roots = targets.length > 0 ? targets : ['README.md', 'docs'];
const files = [];

function collect(path) {
  if (!existsSync(path)) {
    console.error(`нет такого пути: ${path}`);
    process.exitCode = 1;
    return;
  }
  if (statSync(path).isDirectory()) {
    for (const entry of readdirSync(path)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      collect(join(path, entry));
    }
    return;
  }
  if (path.endsWith('.md')) files.push(path);
}

roots.forEach(collect);

const linkPattern = /\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const problems = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const base = dirname(file);
  for (const match of text.matchAll(linkPattern)) {
    const raw = match[1];
    if (/^(https?:|mailto:|tel:|#)/.test(raw)) continue;
    const target = decodeURIComponent(raw.split('#')[0]);
    if (target === '') continue;
    const absolute = resolve(base, target);
    if (!existsSync(absolute)) {
      problems.push(`${file}: ${raw}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`Битые ссылки (${problems.length}):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`Ссылки в порядке: ${files.length} файлов, относительные пути существуют`);
}
