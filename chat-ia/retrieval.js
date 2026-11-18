/* ALMA · recuperación de fragmentos del libro (sin dependencias; funciona en el navegador y en Node).
   Relevancia tipo BM25 + sinónimos propios del libro + frases + tipo de pregunta + diversidad,
   con búsqueda híbrida opcional si hay vectores (embeddings). */
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(); else root.AlmaRetrieval = factory(); })(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var STOP = {}; ("de la que el en y a los del se las por un para con no una su al lo como mas pero sus le ya o este si porque esta entre cuando muy sin sobre tambien me hasta hay donde quien quienes desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mi antes algunos unos yo otro otras otra tanto esa estos mucho nada muchos cual cuales poco ella estar estas algunas algo nosotros es son ser fue ha he soy eres te mis tu tus puedes puedo quiero dime cuentame explica explicame hablame habla libro dice dicen cuando mientras tiene tienen hace hacen hacer era eran fue fueron sido esta estan estaba estaban sobre cada quiere quieres decir significa significan libros papel").split(" ").forEach(function (w) { STOP[w] = 1; });
  /* grupos de sinónimos/expresiones del universo del libro (se comparan por raíz) */
  var SYN = [
    ["miedo", "temor", "temer", "temen", "teme", "temia", "temian", "temieron", "asustar", "susto", "angustia", "terror"], ["creencia", "pensamiento limitante", "conviccion", "idea limitante"], ["maleza", "zarza", "enredadera", "mala hierba", "hierba"],
    ["jardin", "mente"], ["escuchar", "escucha", "oir", "oyente"], ["pregunta", "preguntar", "indagar", "indagacion", "interrogante"], ["sombra", "oscuridad", "oculto"],
    ["luz", "lampara", "ilumina", "resplandor", "brillo"], ["ave", "aves", "pajaros", "custodias", "cuervos"], ["presa", "inundacion", "sumergido", "sumergida", "agua"],
    ["sueno", "sonar", "onirico", "soño"], ["circo", "carpa", "funcion", "nomadas", "caravana", "acrobata"], ["brujula", "rumbo", "norte", "orientar", "orientacion"],
    ["hecho", "hechos", "juicio", "juicios", "opinion", "interpretacion"], ["cambiar", "cambio", "transformar", "transformacion", "transformarse"], ["historia", "relato", "narrar", "cuento", "fabula"],
    ["intuicion", "corazonada", "amuleto", "instinto"], ["decision", "decidir", "elegir", "eleccion", "camino"], ["conversacion", "dialogo", "dialogar", "conversar"],
    ["pasado", "memoria", "recuerdo", "recordar"], ["emocion", "sentimiento", "sentir", "emociones"], ["ejercicio", "practica", "actividad", "practicar"],
    ["conejo", "lazo", "gris"], ["sombrero", "sombreros", "bono"], ["espejo", "reflejo", "reflejar", "sauce"], ["sabio", "sabiduria", "maestro", "mentor", "guia"],
    ["pueblo", "comunidad", "vecinos", "colectivo"], ["templo", "colina"], ["cofre", "tesoro", "documentos"], ["puerta", "llave", "bronce"]
  ];
  var SUF = ["amientos", "imientos", "aciones", "uciones", "amiento", "imiento", "acion", "ucion", "idades", "mente", "idad", "ando", "iendo", "ados", "adas", "idos", "idas", "ado", "ada", "ido", "ida", "ores", "ar", "er", "ir", "es", "as", "os", "s"];
  function norm(s) { return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function stem(w) {
    var i, suf; for (i = 0; i < SUF.length; i++) { suf = SUF[i]; if (w.length - suf.length >= 4 && w.slice(-suf.length) === suf) { w = w.slice(0, -suf.length); break; } }
    if (w.length >= 5 && /[aeo]$/.test(w)) w = w.slice(0, -1);
    return w.length > 7 ? w.slice(0, 7) : w;
  }
  function words(s) { return norm(s).split(/[^a-z0-9ñ]+/).filter(function (w) { return w.length > 2 && !STOP[w]; }); }
  function toks(s) { return words(s).map(stem); }
  var SYNMAP = (function () { var m = {}; SYN.forEach(function (g, gi) { g.forEach(function (w) { norm(w).split(" ").forEach(function (x) { var st = stem(x); (m[st] = m[st] || {})[gi] = 1; }); }); }); return m; })();
  var GROUPSTEMS = SYN.map(function (g) { return g.map(function (w) { return stem(norm(w).split(" ")[0]); }); });

  function create(index) {
    var chunks = index.chunks, N = chunks.length, df = {}, total = 0;
    chunks.forEach(function (c) {
      var tf = {}, tb = {}, n = 0, ts = toks(c.x), hs = toks(c.s + " " + c.t), hd = {};
      ts.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; tb[t] = (tb[t] || 0) + 1; n++; }); hs.forEach(function (t) { tf[t] = (tf[t] || 0) + 2; hd[t] = 1; n += 2; });
      c._tf = tf; c._tb = tb; c._hd = hd; c._len = n; c._n = norm(c.x); total += n; Object.keys(tf).forEach(function (t) { df[t] = (df[t] || 0) + 1; });
    });
    var avg = total / N, K1 = 1.2, B = .75, vecs = null;
    function idf(t) { return Math.log(1 + (N - (df[t] || 0) + .5) / ((df[t] || 0) + .5)); }
    function expand(qs) { /* términos originales (peso 1) + sinónimos (peso .5) */
      var w = {}, g = {}; qs.forEach(function (t) { w[t] = 1; Object.keys(SYNMAP[t] || {}).forEach(function (gi) { g[gi] = 1; }); });
      Object.keys(g).forEach(function (gi) { GROUPSTEMS[gi].forEach(function (t) { if (!w[t]) w[t] = .5; }); }); return w;
    }
    function kind(q) {
      var n = norm(q);
      if (/^\s*(quien|quienes)\b/.test(n)) return "quien"; if (/(donde|en que lugar|que lugar)/.test(n)) return "donde";
      if (/(ejercicio|practica|actividad|como (puedo|hago|trabajo|practico))/.test(n)) return "ejercicio"; if (/(por que|para que|sentido|importancia|que ensena|que aprende)/.test(n)) return "porque";
      if (/(que significa|que es |que son |definicion)/.test(n)) return "def"; return "";
    }
    function boost(c, k, ctx, nq) {
      var m = 1; if (ctx != null && c.cap === ctx) m *= 1.2; if (c.s === "Epígrafe") m *= .6;
      if (/^Ficha de orientación/.test(c.s)) m *= .7;                       /* resumen de apoyo: no es texto del libro */
      if (c.cap === -5) m *= (k === "def" && nq <= 2 ? 1.0 : .75);            /* glosario */
      if (c.cap === -6) m *= (k === "donde" ? 1.6 : .75);
      if (k === "quien" && c.cap === -1) m *= 1.6;
      if (/^Ejercicio/.test(c.s)) m *= (k === "ejercicio" ? 1.4 : .85);
      if (k === "porque" && /(coaching|psicoan)/i.test(c.s)) m *= 1.3; return m;
    }
    function lexical(q, opts) {
      opts = opts || {}; var qs = toks(q), ws = words(q); if (!qs.length) return { list: [], qs: qs, ws: ws, kind: "" };
      var w = expand(qs), k = kind(q), pairs = [], i; for (i = 0; i + 1 < ws.length; i++) pairs.push(ws[i] + " " + ws[i + 1]);
      var meta = { quien: [-1], donde: [-6], def: [-5] }[k] || [], inc = opts.include || [];
      var ex = opts.exclude || [];
      var list = chunks.map(function (c, ci) {
        if (ex.indexOf(c.i) > -1) return { c: c, i: ci, s: 0, m: 0 };
        var isMeta = c.cap === -1 || c.cap === -5 || c.cap === -6 || /^Ficha de orientación/.test(c.s);
        if (isMeta && meta.indexOf(c.cap) < 0 && inc.indexOf(c.cap) < 0 && !(inc.indexOf("ficha") > -1 && /^Ficha de orientación/.test(c.s))) return { c: c, i: ci, s: 0, m: 0 };
        var s = 0, matched = 0, head = 0, len = Math.max(c._len, .6 * avg);
        Object.keys(w).forEach(function (t) { var f = w[t] === 1 ? c._tf[t] : c._tb[t]; if (f) { s += w[t] * idf(t) * (f * (K1 + 1)) / (f + K1 * (1 - B + B * len / avg)); } });
        qs.forEach(function (t) { if (c._tf[t]) matched++; if (c._hd[t]) head++; });
        pairs.forEach(function (p) { if (c._n.indexOf(p) > -1) s += 1.5; });
        return { c: c, i: ci, s: s * boost(c, k, opts.chapter, qs.length) * (1 + .3 * head), m: matched / qs.length };
      }).filter(function (r) { return r.s > 0; });
      return { list: list, qs: qs, ws: ws, kind: k };
    }
    function cos(a, b) { var s = 0, i; for (i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
    function search(q, k, opts) {
      opts = opts || {}; var L = lexical(q, opts), list = L.list;
      if (vecs && opts.qvec) {
        var mx = 0; list.forEach(function (r) { if (r.s > mx) mx = r.s; });
        var seen = {}; list.forEach(function (r) { seen[r.i] = r; });
        chunks.forEach(function (c, ci) { if (!seen[ci]) { var r = { c: c, i: ci, s: 0, m: 0 }; list.push(r); seen[ci] = r; } });
        list.forEach(function (r) { var sem = Math.max(0, cos(vecs[r.i], opts.qvec)); r.sem = sem; r.s = (mx ? .55 * r.s / mx : 0) + .45 * sem * boost(r.c, L.kind, opts.chapter, L.qs.length); });
        list = list.filter(function (r) { return r.s > .12; });
      }
      list.sort(function (a, b) { return b.s - a.s; });
      var out = [], used = {};
      for (var i = 0; i < list.length && out.length < (k || 3); i++) {
        var r = list[i], g = r.c.cap + "|" + r.c.s, pen = used[g] || 0; if (pen >= 2) continue;
        if (pen) { r = { c: r.c, i: r.i, s: r.s * .8, m: r.m, sem: r.sem }; }
        out.push(r); used[g] = pen + 1;
      }
      var top = out[0], conf = "baja";
      if (top) { if (vecs && opts.qvec) conf = top.sem >= .55 || top.m >= .6 ? "alta" : top.sem >= .4 || top.m >= .34 ? "media" : "baja"; else conf = top.m >= .6 && top.s >= 3 ? "alta" : top.m >= .34 && top.s >= 2 ? "media" : "baja"; }
      if (!vecs && out.length && out[0].s < 1.2) out = [];
      return { hits: out.map(function (r) { return r.c; }), scores: out.map(function (r) { return r.s; }), ratio: top ? top.m : 0, conf: conf, kind: L.kind, terms: L.qs };
    }
    function snippet(c, q, max) {
      max = max || 300; var st = {}; toks(q).forEach(function (t) { st[t] = 1; }); Object.keys(expand(toks(q))).forEach(function (t) { st[t] = st[t] || .5; });
      var sents = c.x.match(/[^.!?…]+[.!?…]*\s*/g) || [c.x], sc = sents.map(function (s) { var n = 0; toks(s).forEach(function (t) { if (st[t]) n += st[t]; }); return n; });
      var best = 0, i; for (i = 1; i < sents.length; i++) if (sc[i] > sc[best]) best = i;
      var a = best, b = best, len = sents[best].length;
      while (len < max && (a > 0 || b < sents.length - 1)) { var ca = a > 0 ? sc[a - 1] : -1, cb = b < sents.length - 1 ? sc[b + 1] : -1; if (cb >= ca && b < sents.length - 1 && len + sents[b + 1].length <= max * 1.3) { b++; len += sents[b].length; } else if (a > 0 && len + sents[a - 1].length <= max * 1.3) { a--; len += sents[a].length; } else break; }
      var text = sents.slice(a, b + 1).join("").trim(), parts = [], re = /[\p{L}\p{M}]+|[^\p{L}\p{M}]+/gu, m;
      while ((m = re.exec(text))) { var w = m[0]; parts.push({ t: w, hit: /^[\p{L}\p{M}]/u.test(w) && !!st[stem(norm(w))] && !STOP[norm(w)] && norm(w).length > 2 }); }
      if (text.length > max * 1.35) { text = text.slice(0, max).replace(/\s+\S*$/, "") + " […]"; parts = [{ t: text, hit: false }]; }
      return { text: text, parts: parts, start: a > 0, end: b < sents.length - 1 };
    }
    return { search: search, snippet: snippet, tokens: toks, words: words, kind: kind, setVectors: function (v) { vecs = v; }, hasVectors: function () { return !!vecs; }, stem: stem, norm: norm };
  }
  return { create: create, stem: stem, norm: norm, tokens: toks, words: words };
});
