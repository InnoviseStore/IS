import { default as pdfParse } from 'pdf-parse/lib/pdf-parse.js';
import { readFileSync } from 'fs';

const buf = readFileSync('Análisis del Sistema FINA.pdf');
pdfParse(buf).then(data => {
  console.log('=== PAGES:', data.numpages, '===');
  console.log(data.text);
}).catch(err => {
  console.error('Error:', err.message);
});
