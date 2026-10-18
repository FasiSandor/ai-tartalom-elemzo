import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
mkdirSync(resolve("public"), { recursive: true });
copyFileSync(resolve("node_modules/pdfjs-dist/build/pdf.worker.min.mjs"), resolve("public/pdf.worker.min.mjs"));
console.log("PDF.js worker copied to public/");
