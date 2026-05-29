const fs = require('fs');
const path = require('path');

// Replace corrupted emojis and all emoji sequences with plain text
const emojiReplacements = [
  // Corrupted emoji sequences -> plain text
  [/â˜•\s*/g, ''],
  [/ðŸŒ±\s*/g, ''],
  [/ðŸ·\s*/g, ''],
  [/ðŸ'µ\s*/g, ''],
  [/ðŸ¦\s*/g, ''],
  [/ðŸ"‹\s*/g, ''],
  [/âš ï¸\s*/g, ''],
  [/âœ…\s*/g, ''],
  [/ðŸš›\s*/g, ''],
  [/âŒ\s*/g, ''],
  [/ðŸ›'\s*/g, ''],
  [/ðŸ"¢\s*/g, ''],
  [/ðŸ"\s*/g, ''],
  [/ðŸ"¦\s*/g, ''],
  [/ðŸ§¾\s*/g, ''],
  [/â€¢\s*/g, ''],
  [/ðŸ"±\s*/g, ''],
  [/ðŸ'\s*/g, ''],
  [/ðŸ'·\s*/g, ''],
  [/ðŸ \s*/g, ''],
  [/ðŸ"§\s*/g, ''],
  [/ðŸ"ˆ\s*/g, ''],
  [/ðŸ"Š\s*/g, ''],
  [/ðŸ'¡\s*/g, ''],
  [/â­\s*/g, ''],
  [/ðŸ"—\s*/g, ''],
  [/ðŸ"‹\s*/g, ''],
  [/ðŸŒ\s*/g, ''],
  [/â¤ï¸\s*/g, ''],
  [/ðŸ…\s*/g, ''],
  // Also catch any remaining multi-byte corruption patterns
  [/[âðñ][^\x00-\x7F]*/g, ''],
];

// Specific text replacements for known patterns
const textReplacements = [
  // orders/new - product type buttons
  ['"â˜• Tostado"', '"Tostado"'],
  ['"ðŸŒ± Verde"', '"Verde"'],
  ["'â˜• Tostado'", "'Tostado'"],
  ["'ðŸŒ± Verde'", "'Verde'"],
  // sales/new - payment types
  ['"ðŸ'µ Efectivo"', '"Efectivo"'],
  ['"ðŸ¦ Transferencia"', '"Transferencia"'],
  ['"ðŸ"‹ A crédito"', '"A crédito"'],
  ["'ðŸ'µ Efectivo'", "'Efectivo'"],
  ["'ðŸ¦ Transferencia'", "'Transferencia'"],
  // pending payments
  ['"ðŸ'µ Efectivo"', '"Efectivo"'],
  ['"ðŸ¦ Transferencia"', '"Transferencia"'],
  // orders status
  ['"ðŸ"¥ Empezar tueste"', '"Empezar tueste"'],
  ['"âœ… Marcar listo"', '"Marcar listo"'],
  ['"ðŸš› Marcar entregado"', '"Marcar entregado"'],
  // expenses icons
  ["'âš¡'", "''"],
  ["'ðŸ '", "''"],
  ["'ðŸ"¦'", "''"],
  ["'ðŸ"§'", "''"],
  ["'ðŸ'·'", "''"],
  ["'ðŸ"¢'", "''"],
  ["'ðŸ›''", "''"],
  ["'ðŸ"‹'", "''"],
  // finances
  ['"ðŸ'¡ Estimado', '"Estimado'],
  // labels
  ['"â† Tostado"', '"Tostado"'],
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [from, to] of textReplacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }

  for (const [pattern, replacement] of emojiReplacements) {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      content = newContent;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed emojis:', path.relative(process.cwd(), filePath));
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (!['node_modules', '.next', '.git', 'public'].includes(f)) walk(full);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      try { fixFile(full); } catch(e) { console.error('Error:', full, e.message); }
    }
  }
}

walk('src');
console.log('Emoji fix complete.');
