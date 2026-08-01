// Regenera los PDFs del caso de negocio a partir de las fuentes HTML de esta carpeta.
// Uso: node print-pdf.mjs   (requiere playwright: npm i playwright)
// Salida: ../../Caso-de-Negocio-CRM-Detention.pdf y ../../Business-Case-CRM-Detention.pdf
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const JOBS = [
  { src: 'caso-de-negocio-es.html', out: 'Caso-de-Negocio-CRM-Detention.pdf' },
  { src: 'business-case-en.html', out: 'Business-Case-CRM-Detention.pdf' },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { src, out } of JOBS) {
  await page.goto('file://' + path.join(HERE, src), { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500); // fuentes web
  await page.pdf({ path: path.join(ROOT, out), printBackground: true, preferCSSPageSize: true });
  console.log('OK', out);
}
await browser.close();
