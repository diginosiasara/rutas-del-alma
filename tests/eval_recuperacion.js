#!/usr/bin/env node
/* Evalúa la recuperación de ALMA con preguntas de prueba: node tests/eval_recuperacion.js [--verbose]
   Compara el algoritmo antiguo (TF-IDF simple) con el actual (chat-ia/retrieval.js). Conjunto pequeño y propio: orientativo, no una métrica oficial. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const root = path.join(__dirname, ".."); const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "chat-ia/indice.js"), "utf8"), ctx); const INDEX = ctx.window.ALMA_INDEX;
const R = require(path.join(root, "chat-ia/retrieval.js")); const qs = JSON.parse(fs.readFileSync(path.join(__dirname, "preguntas.json"), "utf8"));
/* --- algoritmo antiguo (v1) --- */
const STOP = {}; "de la que el en y a los del se las por un para con no una su al lo como mas pero sus le ya o este si porque esta entre cuando muy sin sobre tambien me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mi antes algunos unos yo otro otras otra tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros es son ser fue ha he soy eres te mis tu tus puedes puedo quiero dime cuentame explica hablame habla sobre libro dice dicen".split(" ").forEach(w => STOP[w] = 1);
const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const stem1 = w => { w = w.replace(/(mente|ciones|cion|es|s)$/, m => w.length - m.length >= 4 ? "" : m); return w.length > 7 ? w.slice(0, 7) : w; };
const toks1 = s => norm(s).split(/[^a-z0-9ñ]+/).filter(w => w.length > 2 && !STOP[w]).map(stem1);
const df1 = {}; const isMeta = c => c.cap === -1 || c.cap === -5 || c.cap === -6 || /^Ficha de orientación/.test(c.s);
/* Para comparar en igualdad de condiciones, el algoritmo antiguo busca solo en el texto del libro (sin glosario, lugares, personajes ni fichas de resumen, que no son texto del libro). */
const chunks1 = INDEX.chunks.filter(c => !isMeta(c)).map(c => { const tf = {}; toks1(c.x + " " + c.s + " " + c.t).forEach(t => tf[t] = (tf[t] || 0) + 1); Object.keys(tf).forEach(t => df1[t] = (df1[t] || 0) + 1); return { c, tf }; });
const idf1 = t => Math.log(1 + chunks1.length / (1 + (df1[t] || 0)));
function old(q, k) { const qt = toks1(q); return chunks1.map(x => { let s = 0; qt.forEach(t => { if (x.tf[t]) s += (1 + Math.log(x.tf[t])) * idf1(t); }); if (x.c.s === "Epígrafe") s *= .6; if (x.c.cap === -5 || x.c.cap === -6) s *= .85; return { c: x.c, s }; }).filter(r => r.s > 1.6).sort((a, b) => b.s - a.s).slice(0, k).map(r => r.c); }
const ret = R.create(INDEX);
function score(fn) { let h1 = 0, h3 = 0, empty = 0, fails = []; qs.forEach(t => { const h = fn(t.q, 3); if (!h.length) empty++; if (h[0] && t.ok.includes(h[0].cap)) h1++; if (h.some(c => t.ok.includes(c.cap))) h3++; else fails.push(t.q); }); return { h1, h3, empty, fails }; }
const a = score(old), b = score((q, k) => ret.search(q, k).hits), n = qs.length, pct = x => (100 * x / n).toFixed(0) + "%";
console.log(`Preguntas: ${n}`); console.log(`ANTIGUO* acierta en 1º: ${a.h1} (${pct(a.h1)}) | en top-3: ${a.h3} (${pct(a.h3)}) | sin resultado: ${a.empty}`);
console.log(`ACTUAL   acierta en 1º: ${b.h1} (${pct(b.h1)}) | en top-3: ${b.h3} (${pct(b.h3)}) | sin resultado: ${b.empty}`);
console.log('* algoritmo antiguo restringido al texto del libro para una comparación justa (sin fichas de resumen, glosario, lugares ni personajes).');
if (process.argv.includes("--verbose") || b.fails.length) { console.log("\nFallos del actual:"); b.fails.forEach(q => console.log("  ·", q, "→", ret.search(q, 3).hits.map(c => (c.cap + "/" + c.s.slice(0, 18))).join(" | "))); }
process.exit(b.h3 >= a.h3 ? 0 : 1);
