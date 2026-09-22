// brace-audit helper (temporary)
const fs = require('fs');
const lines = fs.readFileSync('task6_regression.mjs', 'utf8').split('\n');
let depth = 0;
lines.forEach((line, i) => {
  const opens = (line.match(/{/g) || []).length;
  const closes = (line.match(/}/g) || []).length;
  const prev = depth;
  depth += opens - closes;
  if (prev === 0 && depth === 1 && line.includes('function main')) console.log('main opens at line', i + 1);
  if (depth < 0) { console.log('NEGATIVE depth at line', i + 1, '=>', line.trim().slice(0, 70)); process.exit(0); }
});
console.log('final depth', depth);
