const { PDFParse } = require('pdf-parse');
const fs = require('fs');

const buf = fs.readFileSync('Análisis del Sistema FINA.pdf');
const parser = new PDFParse();
parser.parse(buf).then(data => {
  console.log('=== PAGES:', data.numpages, '===');
  console.log(data.text);
}).catch(err => {
  console.error('Error:', err.message);
});
