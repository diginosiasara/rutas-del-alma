/* ALMA — asistente de lectura de «Rutas del Alma».
   · Modo libro (siempre disponible): busca en el texto oficial y responde con fragmentos y enlaces. No usa IA ni envía nada fuera.
   · Modo IA (opcional): conecta con un modelo local (Ollama o servidor compatible con OpenAI) elegido por la persona.
   Las conversaciones solo se guardan si se activa «Recordar conversación» y únicamente en este dispositivo. */
(function () {
  "use strict";
  var CFG_KEY = "rutas-alma-config", HIST_KEY = "rutas-alma-historial";
  var DEF = { provider: "none", url: "http://localhost:11434", model: "", temp: 0.6, remember: "0" };
  var cfg = loadCfg(), index = null, history = [], busy = false, abortCtl = null, detected = null;
  var page = location.pathname.split("/").pop() || "index.html";
  var base = (function () { var s = document.querySelector('script[src$="chat-ia/alma.js"]'); return s ? s.getAttribute("src").replace("chat-ia/alma.js", "") : ""; })();

  function loadCfg() { var c = {}, raw = null, k; try { raw = JSON.parse(localStorage.getItem(CFG_KEY)); } catch (e) {} for (k in DEF) c[k] = raw && raw[k] != null ? raw[k] : DEF[k]; return c; }
  function saveCfg() { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {} }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function rich(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>").split(/\n{2,}/).map(function (p) { return "<p>" + p.replace(/\n/g, "<br>") + "</p>"; }).join(""); }

  /* ---------- UI ---------- */
  var fab, panel, log, form, input, send, chips, bubble, chipEl, setBox, foot, lastFocus;
  function build() {
    fab = el("button", { type: "button", class: "alma-fab", "aria-expanded": "false", "aria-controls": "alma-panel", "aria-label": "Hablar con ALMA, asistente del libro", title: "Hablar con ALMA (Alt + Mayús + C)" },
      '<img class="alma-fab__img" src="' + base + 'assets/img/chat/alma-96.webp" srcset="' + base + 'assets/img/chat/alma-96.webp 96w, ' + base + 'assets/img/chat/alma-192.webp 192w" sizes="66px" width="96" height="96" alt="" decoding="async"><span class="alma-fab__dot" aria-hidden="true"></span><span class="alma-fab__x" aria-hidden="true">×</span>');
    panel = el("section", { id: "alma-panel", class: "alma-panel", role: "dialog", "aria-modal": "false", "aria-labelledby": "alma-t", hidden: "" });
    panel.innerHTML =
      '<div class="alma-head"><img src="' + base + 'assets/img/chat/alma-96.webp" width="96" height="96" alt="Ilustración de ALMA, asistente del libro"><div class="alma-head__t"><h2 id="alma-t">ALMA</h2><span class="alma-chip" data-chip>Modo libro</span></div>' +
      '<button type="button" class="alma-ibtn" data-act="set" aria-label="Ajustes de ALMA" aria-expanded="false" title="Ajustes">⚙</button><button type="button" class="alma-ibtn" data-act="clear" aria-label="Borrar la conversación" title="Borrar conversación">🗑</button><button type="button" class="alma-ibtn" data-act="close" aria-label="Cerrar el chat">✕</button></div>' +
      '<div class="alma-log" role="log" aria-live="polite" aria-label="Conversación con ALMA" tabindex="0"></div><div class="alma-chips" data-chips></div>' +
      '<form class="alma-form"><label class="sr-only" for="alma-in">Escribe tu pregunta</label><textarea id="alma-in" rows="1" placeholder="Pregunta sobre el libro…" maxlength="800"></textarea><button type="submit" class="alma-send">Enviar</button></form>' +
      '<p class="alma-foot" data-foot></p>' + settingsHtml();
    bubble = el("div", { class: "alma-bubble", hidden: "", role: "note" }, '¿Te ayudo a explorar el libro?<button type="button" aria-label="Cerrar este aviso">×</button>');
    document.body.appendChild(fab); document.body.appendChild(bubble); document.body.appendChild(panel);
    log = panel.querySelector(".alma-log"); form = panel.querySelector("form"); input = panel.querySelector("textarea"); send = panel.querySelector(".alma-send");
    chips = panel.querySelector("[data-chips]"); chipEl = panel.querySelector("[data-chip]"); setBox = panel.querySelector(".alma-set"); foot = panel.querySelector("[data-foot]");
    fab.addEventListener("click", function () { panel.hidden ? open() : close(); });
    bubble.querySelector("button").addEventListener("click", function () { bubble.hidden = true; try { sessionStorage.setItem("alma-bubble", "1"); } catch (e) {} });
    panel.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return; var a = b.getAttribute("data-act");
      if (a === "close") close(); else if (a === "clear") clearChat(); else if (a === "set") toggleSet();
      else if (a === "test") testConn(); else if (a === "save") { readSet(); toggleSet(false); refreshStatus(); say("Ajustes guardados."); }
    });
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); if (!setBox.hidden) toggleSet(false); else close(); return; }
      if (e.key === "Tab") { var f = Array.prototype.filter.call(panel.querySelectorAll("button,input,select,textarea,a[href]"), function (n) { return !n.disabled && n.offsetParent !== null; }); if (!f.length) return; var a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); if (busy) { if (abortCtl) abortCtl.abort(); return; } var t = input.value.trim(); if (t) { input.value = ""; ask(t); } });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
    chips.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b && !busy) ask(b.textContent); });
    document.addEventListener("keydown", function (e) { if (e.altKey && e.shiftKey && (e.key === "C" || e.key === "c")) { e.preventDefault(); panel.hidden ? open() : close(); } });
    document.addEventListener("click", function (e) { var a = e.target.closest(".alma-src a, .alma-msg a[data-alma]"); if (a && window.innerWidth < 640) close(); });
    refreshStatus();
    try { if (!sessionStorage.getItem("alma-bubble")) setTimeout(function () { if (panel.hidden && !sessionStorage.getItem("alma-bubble")) bubble.hidden = false; }, 5000); } catch (e) {}
  }
  function settingsHtml() {
    return '<div class="alma-set" hidden><h3>Ajustes de ALMA</h3>' +
      '<label for="alma-prov">Cómo responde</label><select id="alma-prov"><option value="none">Solo con el libro (sin IA)</option><option value="auto">Automático: buscar un modelo local</option><option value="ollama">Ollama (manual)</option><option value="openai">Servidor compatible con OpenAI (LM Studio, llama.cpp…)</option></select>' +
      '<label for="alma-url">Dirección del servidor</label><input id="alma-url" type="text" inputmode="url" autocomplete="off" spellcheck="false">' +
      '<label for="alma-model">Modelo</label><input id="alma-model" type="text" list="alma-models" autocomplete="off" spellcheck="false" placeholder="p. ej. qwen3:8b"><datalist id="alma-models"></datalist>' +
      '<label for="alma-temp">Temperatura (0 a 1)</label><input id="alma-temp" type="number" min="0" max="1" step="0.1">' +
      '<label class="alma-row"><input type="checkbox" id="alma-mem"> Recordar la conversación en este dispositivo</label>' +
      '<button type="button" class="alma-b" data-act="test">Probar conexión</button><button type="button" class="alma-b" data-act="save">Guardar</button>' +
      '<p class="alma-note" data-setmsg role="status" aria-live="polite"></p>' +
      '<p class="alma-note"><strong>Privacidad.</strong> En «solo con el libro» nada sale de tu navegador. Con un modelo local, tus preguntas y los fragmentos del libro se envían únicamente al servidor que indiques. Si la dirección no es de tu propio equipo, se avisará. La conversación no se guarda salvo que lo actives.</p>' +
      '<p class="alma-note">Para Ollama desde una web: inicia el servicio con la variable <code>OLLAMA_ORIGINS</code> permitiendo este sitio (p. ej. <code>http://localhost:8000</code>). Consulta <code>modelos-ia/README.md</code>.</p></div>';
  }
  function toggleSet(force) {
    var show = force == null ? setBox.hidden : force; setBox.hidden = !show; panel.querySelector('[data-act="set"]').setAttribute("aria-expanded", String(show));
    if (show) { panel.querySelector("#alma-prov").value = cfg.provider; panel.querySelector("#alma-url").value = cfg.url; panel.querySelector("#alma-model").value = cfg.model; panel.querySelector("#alma-temp").value = cfg.temp; panel.querySelector("#alma-mem").checked = cfg.remember === "1"; panel.querySelector("#alma-prov").focus(); }
    else input.focus();
  }
  function readSet() {
    cfg.provider = panel.querySelector("#alma-prov").value; cfg.url = panel.querySelector("#alma-url").value.trim().replace(/\/+$/, "") || DEF.url;
    cfg.model = panel.querySelector("#alma-model").value.trim(); var t = parseFloat(panel.querySelector("#alma-temp").value); cfg.temp = isNaN(t) ? 0.6 : Math.min(1, Math.max(0, t));
    cfg.remember = panel.querySelector("#alma-mem").checked ? "1" : "0"; if (cfg.remember === "0") { try { localStorage.removeItem(HIST_KEY); } catch (e) {} } saveCfg();
  }
  function setMsg(t) { var m = panel.querySelector("[data-setmsg]"); if (m) m.textContent = t; }
  function say(t) { setMsg(t); }

  function isLocal(u) { try { var h = new URL(u).hostname; return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1"; } catch (e) { return false; } }
  function refreshStatus() {
    var ok = false, txt = "Modo libro (sin IA)";
    if (cfg.provider !== "none" && cfg.model) { ok = true; txt = (cfg.provider === "openai" ? "Servidor compatible" : "Ollama") + " · " + cfg.model; }
    else if (cfg.provider === "auto") txt = "Modo libro · buscando modelo local…";
    chipEl.textContent = txt; chipEl.setAttribute("data-ok", ok ? "1" : "0");
    foot.textContent = ok ? (isLocal(cfg.url) ? "Responde un modelo local; ALMA cita el libro. Puede equivocarse: comprueba en el texto." : "⚠ Servidor no local: tus mensajes salen de tu equipo.") : "ALMA busca en el texto oficial del libro. No sustituye la atención profesional.";
  }
  function open() {
    lastFocus = document.activeElement; panel.hidden = false; bubble.hidden = true; fab.setAttribute("aria-expanded", "true"); fab.setAttribute("aria-label", "Cerrar el chat con ALMA");
    ensureIndex(function () { if (!log.children.length) welcome(); }); if (cfg.provider === "auto" && !cfg.model && !detected) detect(true); /* solo si la persona eligió «automático» en los ajustes */ setTimeout(function () { input.focus(); }, 30);
  }
  function close() { panel.hidden = true; fab.setAttribute("aria-expanded", "false"); fab.setAttribute("aria-label", "Hablar con ALMA, asistente del libro"); fab.focus(); }
  function ensureIndex(cb) {
    if (window.ALMA_INDEX) { index = prepare(window.ALMA_INDEX); return cb && cb(); }
    var s = document.createElement("script"); s.src = base + "chat-ia/indice.js"; s.onload = function () { index = prepare(window.ALMA_INDEX); cb && cb(); };
    s.onerror = function () { botMsg("No he podido cargar el índice del libro. Si abres la web como archivo local, prueba con un servidor (por ejemplo: python3 -m http.server)."); }; document.head.appendChild(s);
  }

  /* ---------- mensajes ---------- */
  function addMsg(cls, html) { var m = el("div", { class: "alma-msg " + cls }, html); log.appendChild(m); log.scrollTop = log.scrollHeight; return m; }
  function userMsg(t) { addMsg("alma-msg--user", "<p>" + esc(t) + "</p>"); history.push({ role: "user", content: t }); persist(); }
  function botMsg(html, srcs, plain) {
    var m = addMsg("alma-msg--bot", html); if (srcs && srcs.length) m.appendChild(srcList(srcs)); if (plain != null) { history.push({ role: "assistant", content: plain }); persist(); } return m;
  }
  function srcList(srcs) { var d = el("div", { class: "alma-src" }, "Ir al texto: "); srcs.forEach(function (s) { var a = el("a", { href: base + s.u, "data-alma": "1" }); a.textContent = s.label; d.appendChild(a); }); return d; }
  function persist() { if (cfg.remember !== "1") return; try { localStorage.setItem(HIST_KEY, JSON.stringify(history.slice(-30))); } catch (e) {} }
  function clearChat() { history = []; log.innerHTML = ""; try { localStorage.removeItem(HIST_KEY); } catch (e) {} welcome(); say(""); }
  function welcome() {
    if (cfg.remember === "1") { try { var h = JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); if (h.length) { history = h; h.forEach(function (m) { addMsg(m.role === "user" ? "alma-msg--user" : "alma-msg--bot", rich(m.content)); }); showChips(); return; } } catch (e) {} }
    var ctx = chapterContext(); botMsg('<p>Hola, soy <strong>ALMA</strong>, la guía de lectura de <em>Rutas del Alma</em>. ' + (ctx ? 'Veo que estás en <strong>' + esc(ctx.label) + '</strong>. ' : '') + 'Puedo buscar ideas en el texto, explicarte un capítulo, hablarte de los personajes o recomendarte por dónde seguir.</p><p>Respondo con el texto oficial del libro y te llevo al apartado donde aparece.</p>');
    showChips();
  }
  function showChips() {
    var ctx = chapterContext(), list = ctx && ctx.n > 0 ? ["Resume este capítulo", "¿Qué ejercicios hay aquí?", "¿Qué personajes aparecen?"] : ["¿Por dónde empiezo?", "¿De qué trata el libro?", "¿Quiénes son los personajes?"];
    list.push("¿Qué es la brújula dorada?"); chips.innerHTML = ""; list.forEach(function (t) { var b = el("button", { type: "button" }); b.textContent = t; chips.appendChild(b); });
  }
  function chapterContext() {
    var m = page.match(/^capitulo-(\d\d)-/); if (m) { var n = parseInt(m[1], 10); var c = chap(n); return { n: n, label: "el capítulo " + n + (c ? " · " + c.t : "") }; }
    if (page === "prologo.html") return { n: 0, label: "el prólogo" }; return null;
  }
  function chap(n) { return index && index.chapters.filter(function (c) { return c.n === n; })[0]; }

  /* ---------- búsqueda en el libro ---------- */
  var STOP = {}; ("de la que el en y a los del se las por un para con no una su al lo como mas pero sus le ya o este si porque esta entre cuando muy sin sobre tambien me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mi antes algunos unos yo otro otras otra tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros es son ser fue ha he soy eres te mis tu tus puedes puedo quiero dime cuentame explica hablame habla sobre libro dice dicen").split(" ").forEach(function (w) { STOP[w] = 1; });
  function norm(s) { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function stem(w) { w = w.replace(/(mente|ciones|cion|es|s)$/, function (m) { return w.length - m.length >= 4 ? "" : m; }); return w.length > 7 ? w.slice(0, 7) : w; }
  function toks(s) { return norm(s).split(/[^a-z0-9ñ]+/).filter(function (w) { return w.length > 2 && !STOP[w]; }).map(stem); }
  function prepare(raw) {
    if (raw._ready) return raw; var df = {}, N = raw.chunks.length;
    raw.chunks.forEach(function (c) { var tf = {}; toks(c.x + " " + c.s + " " + c.t).forEach(function (t) { tf[t] = (tf[t] || 0) + 1; }); c._tf = tf; Object.keys(tf).forEach(function (t) { df[t] = (df[t] || 0) + 1; }); });
    raw._idf = function (t) { return Math.log(1 + N / (1 + (df[t] || 0))); }; raw._ready = true; return raw;
  }
  function search(q, k) {
    var qs = toks(q); if (!qs.length) return []; var ctx = chapterContext();
    var res = index.chunks.map(function (c) { var s = 0; qs.forEach(function (t) { if (c._tf[t]) s += (1 + Math.log(c._tf[t])) * index._idf(t); }); if (s && ctx && c.cap === ctx.n) s *= 1.25; if (c.s === "Epígrafe") s *= .6; return { c: c, s: s }; })
      .filter(function (r) { return r.s > 1.6; }).sort(function (a, b) { return b.s - a.s; });
    return res.slice(0, k || 3).map(function (r) { return r.c; });
  }
  function excerpt(t, n) { n = n || 300; if (t.length <= n) return t; var cut = t.slice(0, n), i = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; ")); return (i > 120 ? cut.slice(0, i + 1) : cut.replace(/\s+\S*$/, "")) + " […]"; }
  function srcOf(c) { return { u: c.u, label: (c.cap > 0 ? "Cap. " + c.cap + " · " : c.cap === 0 ? "Prólogo · " : "") + c.s.replace(/:.*/, "") }; }
  function dedupe(a) { var seen = {}; return a.filter(function (s) { var k = s.u; if (seen[k]) return false; seen[k] = 1; return true; }); }

  /* ---------- intenciones sin IA ---------- */
  var CRISIS = /(suicid|matarme|quitarme la vida|quitarme de en medio|quiero morir|quisiera morir|querria morir|no quiero vivir|no quiero seguir viviendo|no vale la pena vivir|acabar con mi vida|acabar con todo|me quiero hacer dano|quiero hacerme dano|hacerme dano|hacerme algo malo|autolesi|cortarme las venas|desaparecer para siempre)/;
  function chNum(q) { var m = norm(q).match(/cap(?:itulo)?\.?\s*(\d)/); if (m) return parseInt(m[1], 10); if (/prologo/.test(norm(q))) return 0; var c = chapterContext(); return /(este|aqui|actual)/.test(norm(q)) && c ? c.n : null; }
  function localAnswer(q) {
    var n = norm(q), num = chNum(q), out = null;
    if (CRISIS.test(n)) return { html: "<p>Siento que estés pasando por algo tan difícil. Lo que cuentas es importante y no tienes que afrontarlo a solas.</p><p>Si estás en España, puedes llamar ahora al <strong>024</strong> (línea de atención a la conducta suicida) o al <strong>112</strong> si hay peligro inmediato. Si estás en otro país, contacta con tu servicio de emergencias local. También puedes hablar con alguien de confianza o con un profesional de la salud.</p><p>Este libro no sustituye la atención profesional.</p>", plain: "Mensaje de apoyo y recursos de ayuda." };
    if (/^(hola|buenas|hey|buenos dias|buenas tardes|buenas noches)\b/.test(n) && n.length < 30) return { html: "<p>¡Hola! ¿Qué te gustaría explorar del libro?</p>", plain: "Saludo" };
    if (/(que puedes hacer|ayuda|como funciona|que haces)/.test(n) && n.length < 60) return { html: "<p>Puedo <strong>buscar en el texto oficial</strong> cualquier idea o palabra, <strong>resumir un capítulo</strong>, <strong>listar sus ejercicios</strong>, <strong>presentarte a los personajes</strong> y <strong>recomendarte por dónde seguir</strong>. Siempre te enlazo el apartado donde aparece.</p>", plain: "Capacidades" };
    if (/(por donde (empiezo|empezar|comienzo)|donde empiezo|recomiend|empezar a leer|que leo)/.test(n)) {
      var last = null; try { last = (JSON.parse(localStorage.getItem("rutas-lectura")) || {}).last; } catch (e) {}
      var h = "<p>Te sugiero seguir el orden del libro: empieza por el <strong>prólogo</strong> y continúa con el <strong>capítulo 1, El Jardín de la Mente</strong>. Cada capítulo tiene relato, reflexión, ejercicios y espacio para tus notas.</p>";
      var s = [{ u: "prologo.html", label: "Prólogo" }, { u: "capitulo-01-el-jardin.html", label: "Capítulo 1" }];
      if (last && last.page) { h += "<p>Además, la última vez te quedaste en <strong>" + esc(last.title) + "</strong> (" + Math.round(last.pct * 100) + " %).</p>"; s.unshift({ u: last.page + "?continuar=1", label: "Continuar donde lo dejé" }); }
      return { html: h, src: s, plain: "Recomendación de lectura" };
    }
    if (/(resum|de que trata|trata de|sinopsis)/.test(n)) {
      if (num == null && /libro|obra|historia/.test(n)) { var cp = index.chunks.filter(function (c) { return c.s === "Contraportada"; }); if (cp.length) return { html: "<p>" + esc(cp.slice(0, 2).map(function (c) { return c.x; }).join(" ")) + "</p>", src: [{ u: "index.html", label: "Portada" }], plain: cp[0].x }; }
      if (num != null) { var ch = chap(num), st = index.chunks.filter(function (c) { return c.cap === num && c.s === "Relato"; }); if (ch && st.length) { var t = (num === 0 ? "<strong>Prólogo · " : "<strong>Capítulo " + num + " · ") + esc(ch.t) + "</strong>."; if (ch.ep) t += " Epígrafe: «" + esc(ch.ep) + "» — " + esc(ch.epa) + "."; t += "<p>Empieza así: " + esc(excerpt(st[0].x, 340)) + "</p>"; if (st.length > 1) t += "<p>Y termina con: " + esc(excerpt(st[st.length - 1].x.slice(-320), 320)) + "</p>"; return { html: t, src: [{ u: ch.f + "#relato", label: "Leer el relato" }], plain: "Resumen del capítulo " + num }; } }
    }
    if (/ejercicio/.test(n) && num != null && num > 0) { var ex = index.chunks.filter(function (c) { return c.cap === num && /^Ejercicio/.test(c.s); }); if (ex.length) return { html: "<p>En el capítulo " + num + " hay " + ex.length + " ejercicios:</p><p>" + ex.map(function (c) { return "• " + esc(c.s); }).join("<br>") + "</p><p>Puedes escribir tus respuestas debajo de cada uno; se guardan solo en tu dispositivo.</p>", src: [{ u: chap(num).f + "#ejercicios-libro", label: "Ir a los ejercicios" }], plain: "Ejercicios del capítulo " + num }; }
    if (/personaje/.test(n) && !/(quien es|quienes son)/.test(n) || /(quienes son|que personajes)/.test(n)) {
      var pj = index.chunks.filter(function (c) { return c.cap === -1; });
      return { html: "<p>Los personajes principales son: " + pj.map(function (c) { return "<strong>" + esc(c.s.replace("Personaje: ", "")) + "</strong>"; }).join(", ") + ". Pregúntame por cualquiera de ellos.</p>", src: [{ u: "personajes.html", label: "Galería de personajes" }], plain: "Lista de personajes" };
    }
    var nm = index.chunks.filter(function (c) { return c.cap === -1 && toks(c.s.replace("Personaje: ", "")).some(function (t) { return toks(q).indexOf(t) > -1; }); });
    if (nm.length && /(quien|quién|personaje|cuent|habl)/.test(n) && nm.length <= 2) return { html: nm.map(function (c) { return "<p>" + esc(c.x) + "</p>"; }).join(""), src: nm.map(function (c) { return { u: c.u, label: c.s.replace("Personaje: ", "Ficha de ") }; }), plain: nm[0].x };
    return out;
  }
  function localSearch(q) {
    var hits = search(q, 3);
    if (!hits.length) return { html: "<p>No he encontrado nada claro sobre eso en el texto del libro. Prueba con otras palabras o pregúntame por un capítulo, un personaje o un ejercicio.</p>", plain: "Sin resultados" };
    var h = "<p>Esto es lo que dice el libro:</p>" + hits.map(function (c) { return '<div class="alma-quote"><strong>' + esc((c.cap > 0 ? "Cap. " + c.cap + " · " : c.cap === 0 ? "Prólogo · " : "") + c.s) + ":</strong> " + esc(excerpt(c.x, 280)) + "</div>"; }).join("");
    return { html: h, src: dedupe(hits.map(srcOf)), plain: hits.map(function (c) { return c.x; }).join(" ") };
  }

  /* ---------- modelo local (opcional) ---------- */
  function withTimeout(ms) { var c = new AbortController(); var t = setTimeout(function () { c.abort(); }, ms); return { signal: c.signal, done: function () { clearTimeout(t); } }; }
  function detect(silent) {
    var url = cfg.url || DEF.url, w = withTimeout(2500);
    return fetch(url + "/api/tags", { signal: w.signal }).then(function (r) { w.done(); if (!r.ok) throw new Error("http"); return r.json(); }).then(function (j) {
      var ms = (j.models || []).map(function (m) { return m.name; }); detected = ms; var dl = panel.querySelector("#alma-models"); if (dl) dl.innerHTML = ms.map(function (m) { return '<option value="' + esc(m) + '">'; }).join("");
      var pick = ms.filter(function (m) { return !/embed|nomic|bge/.test(m); }); var pref = pick.filter(function (m) { return /qwen|llama|gemma|mistral|phi/.test(m); })[0] || pick[0];
      if (!ms.length) { setMsg("Ollama responde, pero no hay modelos instalados."); return null; }
      if (!cfg.model && pref) { cfg.model = pref; cfg.provider = cfg.provider === "auto" ? "ollama" : cfg.provider; saveCfg(); refreshStatus(); var mi = panel.querySelector("#alma-model"), pi = panel.querySelector("#alma-prov"); if (mi) mi.value = cfg.model; if (pi) pi.value = cfg.provider; }
      setMsg("Conectado. Modelos disponibles: " + ms.join(", ") + "."); return ms;
    }).catch(function () { w.done(); detected = []; if (!silent) setMsg("No he podido conectar con " + url + ". Comprueba que el servicio está en marcha y que permite este origen (OLLAMA_ORIGINS)."); refreshStatus(); return null; });
  }
  function testConn() {
    readSet(); setMsg("Probando…");
    if (cfg.provider === "none") { setMsg("Está configurado «solo con el libro»: no hace falta conexión."); return; }
    if (cfg.provider === "openai") {
      var w = withTimeout(3000); fetch(cfg.url + "/v1/models", { signal: w.signal }).then(function (r) { w.done(); return r.json(); }).then(function (j) { var ms = (j.data || []).map(function (m) { return m.id; }); var dl = panel.querySelector("#alma-models"); dl.innerHTML = ms.map(function (m) { return '<option value="' + esc(m) + '">'; }).join(""); if (!cfg.model && ms[0]) { cfg.model = ms[0]; panel.querySelector("#alma-model").value = ms[0]; saveCfg(); } setMsg("Conectado. Modelos: " + (ms.join(", ") || "ninguno") + "."); refreshStatus(); }).catch(function () { w.done(); setMsg("No he podido conectar con " + cfg.url + "."); });
    } else detect(false);
    if (!isLocal(cfg.url)) setMsg("⚠ Esa dirección no es de tu equipo: tus mensajes saldrán de él.");
  }
  var SYSTEM = "Eres ALMA, la guía de lectura de «Rutas del Alma». Responde en español, con calidez y claridad.\nReglas: 1) Basa tus respuestas sobre el libro SOLO en los FRAGMENTOS que se te dan; cítalos con [1], [2]… 2) Si los fragmentos no bastan, dilo sin inventar. 3) No atribuyas al libro lo que no dice y distingue entre el texto del libro y tus explicaciones. 4) No des consejo médico ni psicológico: el libro no sustituye la atención profesional. 5) Sé breve (máximo unos 150 palabras).";
  function askModel(q, hits, onChunk) {
    var ctxt = hits.length ? hits.map(function (c, i) { return "[" + (i + 1) + "] (" + (c.cap > 0 ? "Capítulo " + c.cap : c.cap === 0 ? "Prólogo" : c.t) + " · " + c.s + ") " + excerpt(c.x, 700); }).join("\n") : "(sin fragmentos relevantes)";
    var cc = chapterContext(), sys = SYSTEM + (cc ? "\nLa persona está leyendo " + cc.label + "." : "");
    var msgs = [{ role: "system", content: sys }].concat(history.slice(-7, -1)).concat([{ role: "user", content: "FRAGMENTOS DEL LIBRO:\n" + ctxt + "\n\nPREGUNTA: " + q }]);
    abortCtl = new AbortController();
    var openai = cfg.provider === "openai", url = cfg.url + (openai ? "/v1/chat/completions" : "/api/chat");
    var body = openai ? { model: cfg.model, messages: msgs, stream: true, temperature: cfg.temp } : { model: cfg.model, messages: msgs, stream: true, options: { temperature: cfg.temp } };
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: abortCtl.signal }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status); var rd = r.body.getReader(), dec = new TextDecoder(), buf = "", full = "";
      function pump() { return rd.read().then(function (x) {
        if (x.done) return full; buf += dec.decode(x.value, { stream: true }); var lines = buf.split("\n"); buf = lines.pop();
        lines.forEach(function (ln) { ln = ln.trim(); if (!ln) return; if (openai) { if (ln.indexOf("data:") !== 0) return; ln = ln.slice(5).trim(); if (ln === "[DONE]") return; } try { var j = JSON.parse(ln), t = openai ? (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content) : (j.message && j.message.content); if (t) { full += t; onChunk(full); } } catch (e) {} });
        return pump(); }); }
      return pump();
    });
  }

  function setBusy(b) { busy = b; send.textContent = b ? "Detener" : "Enviar"; send.setAttribute("data-stop", b ? "1" : "0"); }
  function ask(q) {
    userMsg(q); chips.innerHTML = ""; ensureIndex(function () {
      var la = localAnswer(q);
      if (la) { botMsg(la.html, la.src, la.plain); return; }
      var useModel = cfg.provider !== "none" && cfg.model;
      if (!useModel) { var r = localSearch(q); botMsg(r.html, r.src, r.plain); return; }
      var hits = search(q, 4), m = botMsg('<p class="alma-typing">Pensando</p>'); setBusy(true);
      askModel(q, hits, function (t) { m.innerHTML = rich(t); log.scrollTop = log.scrollHeight; }).then(function (full) {
        if (!full) { m.innerHTML = rich("No he recibido respuesta del modelo."); } history.push({ role: "assistant", content: full || "" }); persist();
        if (hits.length) m.appendChild(srcList(dedupe(hits.map(srcOf)))); setBusy(false); log.scrollTop = log.scrollHeight;
      }).catch(function (err) {
        setBusy(false); if (err && err.name === "AbortError") { m.innerHTML += "<p><em>(respuesta detenida)</em></p>"; return; }
        m.className = "alma-msg alma-msg--err"; m.innerHTML = "<p><strong>No he podido hablar con el modelo.</strong> Comprueba que el servidor está en marcha, que el nombre del modelo es correcto y que permite este origen (en Ollama, <code>OLLAMA_ORIGINS</code>).</p><p>Mientras tanto, te respondo con el libro:</p>";
        var r = localSearch(q); var tmp = el("div", {}, r.html); while (tmp.firstChild) m.appendChild(tmp.firstChild); if (r.src) m.appendChild(srcList(r.src));
      });
    });
  }

  function init() { build(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
