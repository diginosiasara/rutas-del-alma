/* Ayuda con palabras: separa en sílabas, lee la palabra en voz alta y explica su significado.
   Se activa en «Mi lectura» (toca una palabra) o con Alt + Mayús + W sobre una palabra seleccionada. */
(function () {
  "use strict";

  /* ---------- separación silábica del español ---------- */
  var STRONG = "aeoáéó", WEAKACC = "íú", WEAK = "iuü", VOW = "aeiouáéíóúü";
  var ONSET2 = { pr: 1, pl: 1, br: 1, bl: 1, fr: 1, fl: 1, cr: 1, cl: 1, gr: 1, gl: 1, tr: 1, dr: 1, kr: 1, kl: 1 };
  function isV(c) { return VOW.indexOf(c) > -1; }
  function syllabify(word) {
    var w = word.toLowerCase(), i, n = w.length, units = [];
    /* 1) unidades: vocal o consonante (con dígrafos ch, ll, rr, qu, gu+e/i) */
    for (i = 0; i < n; i++) {
      var c = w.charAt(i), d = w.substr(i, 2), nx = w.charAt(i + 2);
      if ((d === "ch" || d === "ll" || d === "rr")) { units.push({ t: d, v: false }); i++; continue; }
      if ((d === "qu" || d === "gu") && /[eéií]/.test(w.charAt(i + 2))) { units.push({ t: d, v: false }); i++; continue; }
      if (c === "y" && i === n - 1 && i > 0) { units.push({ t: c, v: true, k: "weak" }); continue; }
      if (isV(c)) units.push({ t: c, v: true, k: STRONG.indexOf(c) > -1 ? "strong" : WEAKACC.indexOf(c) > -1 ? "weakacc" : "weak" });
      else units.push({ t: c, v: false });
    }
    /* 2) núcleos silábicos: agrupar vocales contiguas salvo hiato */
    var nuclei = [], cur = null;
    units.forEach(function (u, idx) {
      if (!u.v) { cur = null; nuclei.push({ cons: u.t }); return; }
      if (cur) {
        var p = cur.last;
        var hiatus = (p.k === "strong" && u.k === "strong") || p.k === "weakacc" || u.k === "weakacc";
        if (hiatus) { cur = { v: u.t, last: u }; nuclei.push(cur); }
        else { cur.v += u.t; cur.last = u; }
      } else { cur = { v: u.t, last: u }; nuclei.push(cur); }
    });
    /* 3) repartir consonantes entre núcleos */
    var items = nuclei, syls = [], pendingCons = "", started = false, k;
    var seq = [], buf = "";
    items.forEach(function (it) { if (it.cons != null) buf += it.cons; else { seq.push({ c: buf, v: it.v }); buf = ""; } });
    var tail = buf; if (!seq.length) return [word];
    var out = []; var carry = seq[0].c + seq[0].v; out.push(carry);
    for (k = 1; k < seq.length; k++) {
      var cs = seq[k].c, give = "", keep = "", L = cs.length, tokens = splitCons(cs);
      if (tokens.length === 0) { give = ""; keep = ""; }
      else if (tokens.length === 1) { give = tokens[0]; }
      else if (tokens.length === 2) { if (ONSET2[tokens[0] + tokens[1]]) give = cs; else { keep = tokens[0]; give = tokens[1]; } }
      else if (tokens.length === 3) { var last2 = tokens[1] + tokens[2]; if (ONSET2[last2]) { keep = tokens[0]; give = tokens[1] + tokens[2]; } else { keep = tokens[0] + tokens[1]; give = tokens[2]; } }
      else { keep = tokens.slice(0, tokens.length - 2).join(""); give = tokens.slice(-2).join(""); }
      out[out.length - 1] += keep; out.push(give + seq[k].v);
    }
    out[out.length - 1] += tail; return out;
  }
  function splitCons(cs) { var t = [], i; for (i = 0; i < cs.length; i++) { var d = cs.substr(i, 2); if (d === "ch" || d === "ll" || d === "rr" || d === "qu" || d === "gu") { t.push(d); i++; } else t.push(cs.charAt(i)); } return t; }

  /* ---------- glosario sencillo (significados generales, en palabras llanas) ---------- */
  var GLOS = {
    despertar: ["Despertar", "Empezar a darse cuenta de algo que antes no se veía o no se entendía."],
    jardin: ["Jardín", "Terreno con plantas que se cuidan. En el libro sirve de imagen de la propia mente."],
    maleza: ["Maleza", "Hierbas que crecen sin que nadie las cuide y ahogan a las plantas buenas."],
    creencia: ["Creencia", "Idea que damos por cierta sobre nosotros, los demás o la vida, aunque no la hayamos comprobado."],
    limitante: ["Limitante", "Que pone un límite o impide avanzar."],
    brujula: ["Brújula", "Instrumento cuya aguja señala el norte y ayuda a orientarse. Sirve de imagen para encontrar el propio rumbo."],
    lampara: ["Lámpara", "Objeto que da luz. En el libro, la luz que ayuda a ver con claridad."],
    sombra: ["Sombra", "Zona sin luz. En psicología, lo que preferimos no mirar de nosotros mismos."],
    sombrero: ["Sombrero", "Prenda para la cabeza. En el libro, cada color es una forma distinta de mirar un problema."],
    arquetipo: ["Arquetipo", "Modelo o figura muy antigua y conocida (el sabio, el explorador…) que aparece en muchas historias."],
    individuacion: ["Individuación", "Proceso de llegar a ser uno mismo, integrando las distintas partes de la propia personalidad."],
    inconsciente: ["Inconsciente", "Parte de la mente que influye en lo que pensamos y hacemos sin que nos demos cuenta."],
    transferencia: ["Transferencia", "Trasladar a una persona de hoy lo que sentíamos hacia alguien importante del pasado."],
    proyeccion: ["Proyección", "Atribuir a otra persona algo que en realidad es nuestro, como un miedo o un deseo."],
    resiliencia: ["Resiliencia", "Capacidad de recuperarse y seguir adelante después de una dificultad."],
    catarsis: ["Catarsis", "Alivio que se siente al expresar emociones que estaban guardadas."],
    simbolo: ["Símbolo", "Imagen u objeto que representa una idea o un sentimiento."],
    metafora: ["Metáfora", "Forma de decir una cosa comparándola con otra, sin usar «como»."],
    fabula: ["Fábula", "Relato breve, con personajes que a menudo son animales, que deja una enseñanza."],
    nomada: ["Nómada", "Persona o grupo que no vive siempre en el mismo sitio y se desplaza de un lugar a otro."],
    nomadas: ["Nómada", "Persona o grupo que no vive siempre en el mismo sitio y se desplaza de un lugar a otro."],
    ritual: ["Ritual", "Conjunto de gestos que se repiten con un significado especial."],
    integracion: ["Integración", "Unir en un todo partes que estaban separadas."],
    conciencia: ["Conciencia", "Darse cuenta de lo que pasa dentro y fuera de uno."],
    empatia: ["Empatía", "Entender lo que siente otra persona y ponerse en su lugar."],
    perspectiva: ["Perspectiva", "Punto de vista desde el que se mira algo."],
    escucha: ["Escucha", "Atender de verdad a lo que dice otra persona, sin juzgar."],
    juicio: ["Juicio", "Opinión que damos sobre algo o alguien. No es lo mismo que un hecho."],
    hecho: ["Hecho", "Algo que ha ocurrido y se puede comprobar."],
    coaching: ["Coaching", "Acompañamiento en el que una persona ayuda a otra a clarificar lo que quiere y a dar pasos hacia ello."],
    ontologico: ["Ontológico", "Relativo al ser: a cómo somos y cómo vivimos las cosas."],
    psicoanalisis: ["Psicoanálisis", "Forma de entender la mente creada por Freud, que da importancia al inconsciente."],
    psicoanalitica: ["Psicoanalítico", "Relativo al psicoanálisis."],
    paja: ["Paja", "Parte seca y sin valor del trigo. «Separar el grano de la paja» es distinguir lo valioso de lo que no lo es."],
    grano: ["Grano", "Semilla del trigo, que sí alimenta. «Separar el grano de la paja» es distinguir lo valioso de lo que no lo es."],
    sauce: ["Sauce", "Árbol de ramas largas y colgantes que suele crecer junto al agua."],
    gnomo: ["Gnomo", "Personaje de cuento, un ser pequeño de la tierra."],
    custodia: ["Custodia", "Cuidado y vigilancia de algo para protegerlo."],
    custodias: ["Custodia", "Cuidado y vigilancia de algo para protegerlo."]
  };
  function norm(s) { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function lookup(word) {
    var n = norm(word), keys = Object.keys(GLOS), i;
    if (GLOS[n]) return GLOS[n];
    var alt = n.replace(/(es|s)$/, ""); if (GLOS[alt]) return GLOS[alt];
    for (i = 0; i < keys.length; i++) if (keys[i].length >= 6 && n.indexOf(keys[i].slice(0, Math.max(6, keys[i].length - 2))) === 0) return GLOS[keys[i]];
    return null;
  }

  /* ---------- ventana de ayuda ---------- */
  var pop, lastFocus, lastWord = "", say = null;
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function base() { var s = document.querySelector('script[src$="js/ayuda-lectura.js"]'); return s ? s.getAttribute("src").replace("js/ayuda-lectura.js", "") : ""; }
  function voice() { var vs = window.speechSynthesis ? speechSynthesis.getVoices() : []; return vs.filter(function (v) { return /^es/i.test(v.lang); })[0] || null; }
  function speak(list) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { announce("Tu navegador no puede leer en voz alta."); return; }
    speechSynthesis.cancel(); var v = voice();
    list.forEach(function (t) { var u = new SpeechSynthesisUtterance(t); u.lang = "es-ES"; if (v) u.voice = v; u.rate = .8; speechSynthesis.speak(u); });
  }
  function announce(t) { if (say) { say.textContent = ""; setTimeout(function () { say.textContent = t; }, 30); } }
  function bookLinks(word, host) {
    function go() {
      var idx = window.ALMA_INDEX; if (!idx) return; var n = norm(word), found = [], seen = {};
      idx.chunks.forEach(function (c) { if (c.cap === -1 || found.length >= 3) return; if (norm(c.x).indexOf(n) > -1 && !seen[c.u]) { seen[c.u] = 1; found.push(c); } });
      if (!found.length) return;
      host.innerHTML = "En el libro aparece en: " + found.map(function (c) { return '<a href="' + base() + esc(c.u) + '">' + esc((c.cap > 0 ? "Cap. " + c.cap + " · " : c.cap === 0 ? "Prólogo · " : "") + c.s.replace(/:.*/, "")) + "</a>"; }).join("");
    }
    if (window.ALMA_INDEX) return go();
    var s = document.createElement("script"); s.src = base() + "chat-ia/indice.js"; s.onload = go; document.head.appendChild(s);
  }
  function build() {
    pop = el("section", { class: "a-word", role: "dialog", "aria-modal": "false", "aria-labelledby": "a-word-t", hidden: "" });
    say = el("p", { class: "sr-only", role: "status", "aria-live": "polite" });
    document.body.appendChild(pop); document.body.appendChild(say);
    pop.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); close(); return; }
      if (e.key === "Tab") { var f = pop.querySelectorAll("button,a[href]"); if (!f.length) return; var a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    });
    pop.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-w]"); if (!b) return; var a = b.getAttribute("data-w");
      if (a === "close") close(); else if (a === "say") speak([lastWord]); else if (a === "syl") speak(syllabify(lastWord));
    });
  }
  function close() { if (!pop || pop.hidden) return; pop.hidden = true; if (window.speechSynthesis) speechSynthesis.cancel(); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function show(word, x, y) {
    if (!pop) build(); lastWord = word; lastFocus = document.activeElement;
    var syl = syllabify(word), g = lookup(word), n = syl.length;
    pop.innerHTML = '<h2 id="a-word-t" class="sr-only">Ayuda con la palabra «' + esc(word) + '»</h2>' +
      '<div class="a-word__syl" aria-hidden="true">' + syl.map(function (s, i) { return (i ? "<i>·</i>" : "") + "<span>" + esc(s) + "</span>"; }).join("") + '</div>' +
      '<p class="a-word__n">' + esc(word) + " · " + n + (n === 1 ? " sílaba" : " sílabas") + " (" + esc(syl.join("-")) + ")</p>" +
      (g ? '<div class="a-word__def"><strong>Significado sencillo</strong>' + esc(g[1]) + "</div>" : '<p class="a-word__note">No tengo un significado sencillo guardado para esta palabra.</p>') +
      '<p class="a-word__book" data-book></p>' +
      '<div class="a-word__btns"><button type="button" data-w="say">Escuchar</button><button type="button" data-w="syl">Por sílabas</button><button type="button" data-w="close">Cerrar</button></div>' +
      (g ? '<p class="a-word__note">Definición general y sencilla; en el libro puede tener un matiz propio.</p>' : "");
    pop.hidden = false;
    var w = pop.offsetWidth, h = pop.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    var left = Math.min(Math.max(8, x - w / 2), vw - w - 8), top = y + 18; if (top + h > vh - 8) top = Math.max(8, y - h - 18);
    pop.style.left = left + "px"; pop.style.top = top + "px";
    announce(esc(word) + ": " + n + (n === 1 ? " sílaba" : " sílabas") + ", " + syl.join(" ") + (g ? ". " + g[1] : ""));
    bookLinks(word, pop.querySelector("[data-book]"));
    pop.querySelector('button[data-w="say"]').focus();
  }

  /* ---------- activación ---------- */
  function wordAt(x, y) {
    var r = null, node, off;
    if (document.caretPositionFromPoint) { var p = document.caretPositionFromPoint(x, y); if (p) { node = p.offsetNode; off = p.offset; } }
    else if (document.caretRangeFromPoint) { r = document.caretRangeFromPoint(x, y); if (r) { node = r.startContainer; off = r.startOffset; } }
    if (!node || node.nodeType !== 3) return null;
    var t = node.nodeValue, re = /[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu, m;
    while ((m = re.exec(t))) { if (off >= m.index && off <= m.index + m[0].length) return m[0]; }
    return null;
  }
  document.addEventListener("click", function (e) {
    if (document.documentElement.getAttribute("data-a-wordhelp") !== "1") return;
    if (e.target.closest("a, button, input, textarea, select, summary, label, .a-panel, .a-word, .alma-panel, .reader, nav, .menu, [role=dialog]")) return;
    if (!e.target.closest("main")) return;
    var sel = window.getSelection && String(window.getSelection()).trim(), w = null;
    if (sel && /^[\p{L}\p{M}'’-]+$/u.test(sel)) w = sel; else if (!sel) w = wordAt(e.clientX, e.clientY);
    if (w && w.length > 1) show(w, e.clientX, e.clientY);
  });
  function fromSelection(text) {
    var t = (text != null ? text : String(window.getSelection ? window.getSelection() : "")).trim();
    if (!/^[\p{L}\p{M}'’-]+$/u.test(t)) { if (!pop) build(); announce("Selecciona una sola palabra y vuelve a intentarlo."); return; }
    var r = null; try { var s = window.getSelection(); if (s.rangeCount) r = s.getRangeAt(0).getBoundingClientRect(); } catch (er) {}
    show(t, r && r.width ? r.left + r.width / 2 : window.innerWidth / 2, r && r.height ? r.bottom : window.innerHeight / 3);
  }
  document.addEventListener("rutas:consultar", function (e) { fromSelection(e.detail && e.detail.text); });
  document.addEventListener("keydown", function (e) { if (e.altKey && e.shiftKey && (e.key === "W" || e.key === "w")) { e.preventDefault(); fromSelection(); } });
  window.RutasAyuda = { syllabify: syllabify };
})();
