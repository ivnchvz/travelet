const fs = require('fs');

const W = 420, H = 595;
const esc = s => s.replace(/([()\\])/g, '\\$1');

const out = [];
const text = (font, size, x, y, s) =>
  out.push(`BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${esc(s)}) Tj ET`);
const rect = (x, y, w, h, gray) => out.push(`${gray} g ${x} ${y} ${w} ${h} re f`);
const line = (x, y, w, gray = '0.75') => out.push(`${gray} G 0.8 w ${x} ${y} m ${x + w} ${y} l S`);

// header band
rect(0, H - 78, W, 78, '0.08');
out.push('1 1 1 rg');
text('F2', 15, 40, H - 42, 'TRAVELET AIRWAYS');
text('F1', 9, 40, H - 60, 'BOARDING PASS / TARJETA DE EMBARQUE');
out.push('0 g');

// route — two codes far apart on one line, cities beneath
text('F2', 42, 40, H - 150, 'MAD');
text('F2', 42, 250, H - 150, 'BCN');
text('F1', 10, 40, H - 164, 'Madrid');
text('F1', 10, 250, H - 164, 'Barcelona');
line(40, H - 192, 340);

// captioned fields, caption above value in the same column
const rows = [
  [['PASSENGER', 'GARCIA/ANA']],
  [['FLIGHT', 'TR 1042'], ['DATE', '14 MAR 2026']],
  [['BOARDING', '09:05'], ['DEPARTURE', '09:35']],
  [['ARRIVAL', '11:00'], ['SEAT', '14A']],
  [['GATE', 'B12'], ['TERMINAL', '4']],
  [['BOOKING REFERENCE', 'QZ7K4M']],
];
let y = H - 226;
for (const row of rows) {
  row.forEach(([caption, value], i) => {
    const x = 40 + i * 190;
    text('F1', 7.5, x, y, caption);
    text('F2', 13, x, y - 16, value);
  });
  y -= 46;
}

line(40, y + 20, 340);
text('F1', 7.5, 40, y, 'A SAMPLE DOCUMENT, INCLUDED WITH TRAVELET');
text('F1', 7.5, 40, y - 12, 'Throw it away whenever you like.');

// a stand-in for the barcode block
rect(40, y - 78, 340, 52, '0.9');
text('F1', 7, 150, y - 56, 'SAMPLE - NOT A SCANNABLE CODE');

const content = out.join('\n');
const objs = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
  `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
];

let pdf = '%PDF-1.4\n';
const offsets = [];
objs.forEach((body, i) => {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});
const xref = pdf.length;
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
for (const o of offsets) pdf += String(o).padStart(10, '0') + ' 00000 n \n';
pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

fs.writeFileSync('/Users/wasserstiefel/Documents/travelet/assets/sample/boarding-pass.pdf', pdf, 'latin1');
console.log('wrote', pdf.length, 'bytes');
