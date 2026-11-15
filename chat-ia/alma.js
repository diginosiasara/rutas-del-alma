/* ALMA — asistente de lectura de «Rutas del Alma» (v2).
   · Modo libro (siempre disponible, sin red): busca en el texto oficial y responde con fragmentos y enlaces.
   · Modo IA (opcional): modelo del paquete local (modelos-ia/), Ollama, otros servidores locales compatibles con OpenAI,
     o un proveedor externo solo si se habilita expresamente.
   · Voz: lee en voz alta las respuestas (SpeechSynthesis del navegador).
   Dos niveles de ajustes: «Para ti» (perfil, longitud, voz…) y «Avanzado» (proveedores y modelos).
   Las conversaciones solo se guardan si se activa «Recordar la conversación», y solo en este dispositivo. */
(function () {
  "use strict";
  var CFG_KEY = "rutas-alma-config", HIST_KEY = "rutas-alma-historial";
  var SITE = window.ALMA_CONFIG || {};   /* p. ej. window.ALMA_CONFIG = { hideAdmin: true, allowExternal: false } antes de cargar alma.js */
  var PROFILES = {
    narrativo: { n: "Narrativo", i: "Responde con un tono literario y descriptivo, cuidando las imágenes del libro, sin inventar hechos.", k: 3, x: 380, intro: "Así lo cuenta el libro:" },
    conversacional: { n: "Conversacional", i: "Responde de forma natural y cercana, como en una charla.", k: 3, x: 300, intro: "Esto es lo que dice el libro:" },
    analitico: { n: "Analítico", i: "Explica con detalle y estructura: ideas, relaciones y matices.", k: 4, x: 420, intro: "Estos son los pasajes relacionados:" },
    resumido: { n: "Resumido", i: "Responde con la máxima brevedad: dos o tres frases.", k: 2, x: 190, intro: "En breve, según el libro:" },
    investigador: { n: "Investigador", i: "Relaciona personajes, capítulos y conceptos y cita siempre las referencias del libro con [n].", k: 5, x: 340, intro: "Referencias del libro sobre tu pregunta:" },
    didactico: { n: "Didáctico", i: "Explica de forma sencilla y pedagógica, con un ejemplo cuando ayude.", k: 3, x: 300, intro: "Veámoslo con el propio texto del libro:" },
    creativo: { n: "Creativo", i: "Propón interpretaciones e ideas imaginativas, dejando claro qué es tu interpretación y qué dice el libro.", k: 3, x: 300, intro: "El libro dice esto; a partir de ahí podemos imaginar:" }
  };
  var LENGTHS = { corta: { n: "Corta", w: 80, tok: 180 }, media: { n: "Media", w: 150, tok: 340 }, larga: { n: "Larga", w: 300, tok: 700 } };
  var DEF = { provider: "none", url: "http://localhost:11434", model: "", creativity: 0.6, profile: "conversacional", length: "media", extra: "", remember: "0", voice: "", rate: 1, autoread: "0", consent: "0", extUrl: "", extOk: "0", resolved: null };
  var cfg = loadCfg(), index = null, history = [], busy = false, abortCtl = null, sessionToken = "", speakToken = 0, lastReport = [];
  var page = location.pathname.split("/").pop() || "index.html";
  var base = (function () { var s = document.querySelector('script[src$="chat-ia/alma.js"]'); return s ? s.getAttribute("src").replace("chat-ia/alma.js", "") : ""; })();

  function loadCfg() { var c = {}, raw = null, k; try { raw = JSON.parse(localStorage.getItem(CFG_KEY)); } catch (e) {} for (k in DEF) c[k] = raw && raw[k] != null ? raw[k] : DEF[k]; if (raw && raw.temp != null && raw.creativity == null) c.creativity = raw.temp; if (!PROFILES[c.profile]) c.profile = "conversacional"; if (!LENGTHS[c.length]) c.length = "media"; return c; }
  function saveCfg() { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {} }
  function mk(tag, props, kids) { var e = document.createElement(tag), k; for (k in (props || {})) { if (k === "text") e.textContent = props[k]; else if (k === "html") e.innerHTML = props[k]; else e.setAttribute(k, props[k]); } (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); }); return e; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function rich(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>").split(/\n{2,}/).map(function (p) { return "<p>" + p.replace(/\n/g, "<br>") + "</p>"; }).join(""); }
  function safeUrl(u) { try { var x = new URL(String(u).trim()); if (x.protocol !== "http:" && x.protocol !== "https:") return null; return x.origin + (x.pathname === "/" ? "" : x.pathname.replace(/\/+$/, "")); } catch (e) { return null; } }
  function isLocal(u) { try { var h = new URL(u).hostname; return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1"; } catch (e) { return false; } }
  function effective() { /* proveedor realmente usado */
    var p = cfg.provider; if (p === "none") return null;
    if (p === "auto") return cfg.resolved && cfg.resolved.model ? cfg.resolved : null;
    if (p === "external") return cfg.extOk === "1" && cfg.model && safeUrl(cfg.extUrl) ? { provider: "external", url: safeUrl(cfg.extUrl), model: cfg.model } : null;
    return cfg.model && safeUrl(cfg.url) ? { provider: p, url: safeUrl(cfg.url), model: cfg.model } : null;
  }
  function provLabel(p) { return { packaged: "Paquete local", ollama: "Ollama", openai: "Servidor compatible", external: "Proveedor externo" }[p] || p; }

  /* ---------- interfaz ---------- */
  var fab, panel, log, form, input, send, chips, bubble, chipEl, setBox, foot, tabPanels = {};
  function build() {
    fab = mk("button", { type: "button", class: "alma-fab", "aria-expanded": "false", "aria-controls": "alma-panel", "aria-label": "Hablar con ALMA, asistente del libro", title: "Hablar con ALMA (Alt + Mayús + C)" });
    var img = mk("img", { class: "alma-fab__img", src: base + "assets/img/chat/alma-96.webp", srcset: base + "assets/img/chat/alma-96.webp 96w, " + base + "assets/img/chat/alma-192.webp 192w", sizes: "66px", width: "96", height: "96", alt: "", decoding: "async" });
    fab.appendChild(img); fab.appendChild(mk("span", { class: "alma-fab__dot", "aria-hidden": "true" })); fab.appendChild(mk("span", { class: "alma-fab__x", "aria-hidden": "true", text: "×" }));
    panel = mk("section", { id: "alma-panel", class: "alma-panel", role: "dialog", "aria-modal": "false", "aria-labelledby": "alma-t", hidden: "" });
    var head = mk("div", { class: "alma-head" }, [
      mk("img", { src: base + "assets/img/chat/alma-96.webp", width: "96", height: "96", alt: "Ilustración de ALMA, asistente del libro" }),
      mk("div", { class: "alma-head__t" }, [mk("h2", { id: "alma-t", text: "ALMA" }), mk("span", { class: "alma-chip", "data-chip": "", text: "Modo libro" })]),
      mk("button", { type: "button", class: "alma-ibtn", "data-act": "stopvoice", "aria-label": "Detener la voz", title: "Detener la voz", text: "⏹" }),
      mk("button", { type: "button", class: "alma-ibtn", "data-act": "set", "aria-label": "Ajustes de ALMA", "aria-expanded": "false", title: "Ajustes", text: "⚙" }),
      mk("button", { type: "button", class: "alma-ibtn", "data-act": "clear", "aria-label": "Borrar la conversación", title: "Borrar conversación", text: "🗑" }),
      mk("button", { type: "button", class: "alma-ibtn", "data-act": "close", "aria-label": "Cerrar el chat", text: "✕" })]);
    log = mk("div", { class: "alma-log", role: "log", "aria-live": "polite", "aria-label": "Conversación con ALMA", tabindex: "0" });
    chips = mk("div", { class: "alma-chips" });
    input = mk("textarea", { id: "alma-in", rows: "1", placeholder: "Pregunta sobre el libro…", maxlength: "800" });
    send = mk("button", { type: "submit", class: "alma-send", text: "Enviar" });
    form = mk("form", { class: "alma-form" }, [mk("label", { class: "sr-only", for: "alma-in", text: "Escribe tu pregunta" }), input, send]);
    foot = mk("p", { class: "alma-foot" });
    setBox = buildSettings();
    [head, log, chips, form, foot, setBox].forEach(function (n) { panel.appendChild(n); });
    chipEl = head.querySelector("[data-chip]");
    bubble = mk("div", { class: "alma-bubble", hidden: "", role: "note" }, ["¿Te ayudo a explorar el libro?", mk("button", { type: "button", "aria-label": "Cerrar este aviso", text: "×" })]);
    document.body.appendChild(fab); document.body.appendChild(bubble); document.body.appendChild(panel);
    fab.addEventListener("click", function () { panel.hidden ? open() : close(); });
    bubble.querySelector("button").addEventListener("click", function () { bubble.hidden = true; try { sessionStorage.setItem("alma-bubble", "1"); } catch (e) {} });
    panel.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return; var a = b.getAttribute("data-act");
      if (a === "close") close(); else if (a === "clear") clearChat(); else if (a === "set") toggleSet(); else if (a === "stopvoice") stopSpeech();
      else if (a === "save") { readSet(); toggleSet(false); refreshStatus(); }
      else if (a === "detect") runDetect(); else if (a === "test") testConn(); else if (a === "testvoice") speakText("Hola, soy ALMA. Así suena mi voz con estos ajustes.");
      else if (a === "tab") selectTab(b.getAttribute("data-tab"));
    });
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); if (!setBox.hidden) toggleSet(false); else close(); return; }
      if (e.key === "Tab") { var f = Array.prototype.filter.call(panel.querySelectorAll("button,input,select,textarea,a[href]"), function (n) { return !n.disabled && n.offsetParent !== null; }); if (!f.length) return; var a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); if (busy) { if (abortCtl) abortCtl.abort(); return; } var t = input.value.trim(); if (t) { input.value = ""; ask(t); } });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
    chips.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b && !busy) ask(b.textContent); });
    log.addEventListener("click", function (e) { var b = e.target.closest("[data-listen]"); if (!b) return; var m = b.closest(".alma-msg"); if (b.getAttribute("aria-pressed") === "true") { stopSpeech(); return; } speakText(plainOf(m), b); });
    document.addEventListener("keydown", function (e) { if (e.altKey && e.shiftKey && (e.key === "C" || e.key === "c")) { e.preventDefault(); panel.hidden ? open() : close(); } });
    document.addEventListener("click", function (e) { var a = e.target.closest(".alma-src a"); if (a && window.innerWidth < 640) close(); });
    refreshStatus();
    try { if (!sessionStorage.getItem("alma-bubble")) setTimeout(function () { if (panel.hidden && !sessionStorage.getItem("alma-bubble")) bubble.hidden = false; }, 5000); } catch (e) {}
    if (/[?&]leer=1/.test(location.search)) setTimeout(function () { var f = document.querySelector('button[aria-controls="reader-panel"]'), p = document.getElementById("reader-panel"); if (f && p && p.hidden) f.click(); }, 900);
  }

  /* --- ajustes: dos niveles --- */
  function fld(id, label, control, hint) { var w = mk("div", { class: "alma-f" }, [mk("label", { for: id, text: label }), control]); if (hint) w.appendChild(mk("p", { class: "alma-hint", text: hint })); return w; }
  function sel(id, opts, cur) { var s = mk("select", { id: id }); opts.forEach(function (o) { var op = mk("option", { value: o[0], text: o[1] }); if (o[0] === cur) op.selected = true; s.appendChild(op); }); return s; }
  function chk(id, label, on) { var c = mk("input", { type: "checkbox", id: id }); c.checked = !!on; return mk("label", { class: "alma-row", for: id }, [c, label]); }
  function buildSettings() {
    var box = mk("div", { class: "alma-set", hidden: "" });
    var tabs = mk("div", { class: "alma-tabs", role: "tablist", "aria-label": "Tipos de ajustes" }, [mk("button", { type: "button", role: "tab", "data-act": "tab", "data-tab": "user", id: "alma-tab-user", "aria-selected": "true", "aria-controls": "alma-tp-user", text: "Para ti" })]);
    if (!SITE.hideAdmin) tabs.appendChild(mk("button", { type: "button", role: "tab", "data-act": "tab", "data-tab": "admin", id: "alma-tab-admin", "aria-selected": "false", "aria-controls": "alma-tp-admin", tabindex: "-1", text: "Avanzado" }));
    box.appendChild(tabs);
    /* Para ti */
    var u = mk("div", { role: "tabpanel", id: "alma-tp-user", "aria-labelledby": "alma-tab-user" });
    u.appendChild(fld("alma-profile", "Cómo quieres que responda", sel("alma-profile", Object.keys(PROFILES).map(function (k) { return [k, PROFILES[k].n]; }), cfg.profile)));
    u.appendChild(fld("alma-length", "Longitud de las respuestas", sel("alma-length", Object.keys(LENGTHS).map(function (k) { return [k, LENGTHS[k].n]; }), cfg.length), "Con un modelo de IA marca el tamaño; en modo libro cambia cuántos fragmentos se muestran."));
    u.appendChild(fld("alma-creat", "Creatividad (0 = literal, 1 = libre)", mk("input", { id: "alma-creat", type: "range", min: "0", max: "1", step: "0.1", value: String(cfg.creativity) }), "Solo afecta cuando hay un modelo de IA conectado."));
    u.appendChild(fld("alma-extra", "Instrucciones adicionales (opcional)", mk("textarea", { id: "alma-extra", rows: "3", maxlength: "400", placeholder: "p. ej. «Explícame como si tuviera diez años»" }), "No pueden contradecir las reglas de fidelidad al libro."));
    var voiceSel = sel("alma-voice", [["", "Voz predeterminada del navegador"]], cfg.voice); u.appendChild(fld("alma-voice", "Voz", voiceSel));
    u.appendChild(fld("alma-rate", "Velocidad de la voz", mk("input", { id: "alma-rate", type: "range", min: "0.7", max: "1.4", step: "0.1", value: String(cfg.rate) })));
    u.appendChild(chk("alma-auto", "Leer las respuestas en voz alta automáticamente", cfg.autoread === "1"));
    u.appendChild(chk("alma-mem", "Recordar la conversación en este dispositivo", cfg.remember === "1"));
    u.appendChild(mk("button", { type: "button", class: "alma-b", "data-act": "testvoice", text: "Probar voz" }));
    u.appendChild(mk("button", { type: "button", class: "alma-b", "data-act": "save", text: "Guardar" }));
    box.appendChild(u); tabPanels.user = u;
    /* Avanzado */
    var a = mk("div", { role: "tabpanel", id: "alma-tp-admin", "aria-labelledby": "alma-tab-admin", hidden: "" });
    a.appendChild(mk("p", { class: "alma-note", html: "<strong>Para quien administra el sitio.</strong> Aquí se elige el motor de IA. En una web estática no hay contraseña: si publicas ALMA para el público, oculta esta pestaña con <code>window.ALMA_CONFIG = { hideAdmin: true }</code>." }));
    a.appendChild(fld("alma-prov", "Cómo responde ALMA", sel("alma-prov", [["none", "Solo con el libro (sin IA)"], ["auto", "Automático (por prioridad)"], ["packaged", "Paquete local (modelos-ia/)"], ["ollama", "Ollama (manual)"], ["openai", "Servidor local compatible con OpenAI"], ["external", "Proveedor externo (opcional)"]], cfg.provider)));
    a.appendChild(fld("alma-url", "Dirección del servicio", mk("input", { id: "alma-url", type: "text", inputmode: "url", autocomplete: "off", spellcheck: "false" })));
    var model = mk("input", { id: "alma-model", type: "text", list: "alma-models", autocomplete: "off", spellcheck: "false", placeholder: "p. ej. qwen3:8b" }); var dl = mk("datalist", { id: "alma-models" });
    a.appendChild(fld("alma-model", "Modelo", model)); a.appendChild(dl);
    if (SITE.allowExternal !== false) {
      a.appendChild(fld("alma-exturl", "Proveedor externo: dirección (https)", mk("input", { id: "alma-exturl", type: "text", inputmode: "url", autocomplete: "off", spellcheck: "false", placeholder: "https://…" })));
      a.appendChild(fld("alma-token", "Clave de acceso (opcional; solo se guarda hasta cerrar la pestaña)", mk("input", { id: "alma-token", type: "password", autocomplete: "off" }), "No escribas aquí claves de uso general: viajan desde el navegador. Para el público, usa un servidor intermedio."));
      a.appendChild(chk("alma-extok", "Entiendo que, con un proveedor externo, mis preguntas y los fragmentos del libro saldrán de mi equipo.", cfg.extOk === "1"));
    }
    a.appendChild(mk("button", { type: "button", class: "alma-b", "data-act": "detect", text: "Buscar modelos" }));
    a.appendChild(mk("button", { type: "button", class: "alma-b", "data-act": "test", text: "Probar conexión" }));
    a.appendChild(mk("button", { type: "button", class: "alma-b", "data-act": "save", text: "Guardar" }));
    a.appendChild(mk("ol", { class: "alma-report", "aria-label": "Resultado de la búsqueda de modelos" }));
    a.appendChild(mk("p", { class: "alma-note", "data-setmsg": "", role: "status", "aria-live": "polite" }));
    a.appendChild(mk("p", { class: "alma-note", html: "<strong>Prioridad automática:</strong> 1) paquete <code>modelos-ia/</code> con su servicio local, 2) Ollama, 3) Antigravity (se integra por MCP; no se detecta desde el navegador), 4) otros servidores locales (LM Studio, llama.cpp…), 5) proveedor externo solo si lo habilitas. <a href=\"" + base + "privacidad.html#alma\">Privacidad</a> · <a href=\"" + base + "modelos-ia/README.md\">Guía de modelos</a>." }));
    box.appendChild(a); tabPanels.admin = a;
    return box;
  }
  function selectTab(t) {
    Object.keys(tabPanels).forEach(function (k) { tabPanels[k].hidden = k !== t; var b = panel.querySelector("#alma-tab-" + k); if (b) { b.setAttribute("aria-selected", String(k === t)); b.setAttribute("tabindex", k === t ? "0" : "-1"); } });
  }
  function $(id) { return panel.querySelector("#" + id); }
  function toggleSet(force) {
    var show = force == null ? setBox.hidden : force; setBox.hidden = !show; panel.querySelector('[data-act="set"]').setAttribute("aria-expanded", String(show));
    if (show) { fillSet(); loadVoices(); $("alma-profile").focus(); } else input.focus();
  }
  function fillSet() {
    $("alma-profile").value = cfg.profile; $("alma-length").value = cfg.length; $("alma-creat").value = cfg.creativity; $("alma-extra").value = cfg.extra; $("alma-rate").value = cfg.rate; $("alma-auto").checked = cfg.autoread === "1"; $("alma-mem").checked = cfg.remember === "1";
    if ($("alma-prov")) { $("alma-prov").value = cfg.provider; $("alma-url").value = cfg.url; $("alma-model").value = cfg.model; if ($("alma-exturl")) { $("alma-exturl").value = cfg.extUrl; $("alma-token").value = sessionToken; $("alma-extok").checked = cfg.extOk === "1"; } }
  }
  function readSet() {
    cfg.profile = $("alma-profile").value; cfg.length = $("alma-length").value; cfg.creativity = Math.min(1, Math.max(0, parseFloat($("alma-creat").value) || 0)); cfg.extra = $("alma-extra").value.slice(0, 400);
    cfg.voice = $("alma-voice").value; cfg.rate = Math.min(1.4, Math.max(0.7, parseFloat($("alma-rate").value) || 1)); cfg.autoread = $("alma-auto").checked ? "1" : "0"; cfg.remember = $("alma-mem").checked ? "1" : "0";
    if (cfg.remember === "0") { try { localStorage.removeItem(HIST_KEY); } catch (e) {} }
    if ($("alma-prov")) {
      cfg.provider = $("alma-prov").value; var u = safeUrl($("alma-url").value); cfg.url = u || DEF.url; cfg.model = $("alma-model").value.trim();
      if ($("alma-exturl")) { cfg.extUrl = $("alma-exturl").value.trim(); sessionToken = $("alma-token").value; cfg.extOk = $("alma-extok").checked ? "1" : "0"; }
      if (cfg.provider === "external" && (!/^https:/.test(cfg.extUrl) && !isLocal(cfg.extUrl))) { setMsg("El proveedor externo debe usar https."); cfg.provider = "none"; }
    }
    saveCfg();
  }
  function setMsg(t) { var m = panel.querySelector("[data-setmsg]"); if (m) m.textContent = t; }
  function refreshStatus() {
    var eff = effective(), txt = "Modo libro (sin IA)";
    if (eff) txt = provLabel(eff.provider) + " · " + eff.model; else if (cfg.provider === "auto") txt = "Modo libro · automático sin modelo";
    chipEl.textContent = txt; chipEl.setAttribute("data-ok", eff ? "1" : "0");
    foot.textContent = eff ? (isLocal(eff.url) ? "Responde un modelo local; ALMA cita el libro. Puede equivocarse: comprueba en el texto." : "⚠ Servidor no local: tus mensajes salen de tu equipo.") : "ALMA busca en el texto oficial del libro. No sustituye la atención profesional.";
  }
  function open() {
    panel.hidden = false; bubble.hidden = true; fab.setAttribute("aria-expanded", "true"); fab.setAttribute("aria-label", "Cerrar el chat con ALMA");
    ensureIndex(function () { if (!log.children.length) welcome(); });
    if (cfg.provider === "auto" && !effective() && cfg.consent === "1") runDetect(true);
    setTimeout(function () { input.focus(); }, 30);
  }
  function close() { panel.hidden = true; fab.setAttribute("aria-expanded", "false"); fab.setAttribute("aria-label", "Hablar con ALMA, asistente del libro"); stopSpeech(); fab.focus(); }
  function ensureIndex(cb) {
    if (window.ALMA_INDEX) { index = prepare(window.ALMA_INDEX); return cb && cb(); }
    var s = document.createElement("script"); s.src = base + "chat-ia/indice.js"; s.onload = function () { index = prepare(window.ALMA_INDEX); cb && cb(); };
    s.onerror = function () { botMsg("No he podido cargar el índice del libro. Si abres la web como archivo local, prueba con un servidor (por ejemplo: python3 -m http.server)."); }; document.head.appendChild(s);
  }

  /* ---------- voz ---------- */
  var voices = [];
  function loadVoices() {
    if (!window.speechSynthesis) return; voices = speechSynthesis.getVoices().filter(function (v) { return /^es/i.test(v.lang); });
    var s = $("alma-voice"); if (!s || s.options.length > 1 && voices.length + 1 === s.options.length) return;
    while (s.options.length > 1) s.remove(1); voices.forEach(function (v) { var o = mk("option", { value: v.voiceURI, text: v.name + " (" + v.lang + ")" }); s.appendChild(o); }); s.value = cfg.voice;
  }
  if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener("voiceschanged", loadVoices);
  function sentences(t) { var parts = t.match(/[^.!?…]+[.!?…]*\s*/g) || [t], out = [], cur = ""; parts.forEach(function (p) { if (cur && (cur + p).length > 200) { out.push(cur); cur = ""; } cur += p; }); if (cur.trim()) out.push(cur); return out; }
  function stopSpeech() { speakToken++; if (window.speechSynthesis) speechSynthesis.cancel(); Array.prototype.forEach.call(document.querySelectorAll("[data-listen][aria-pressed=true]"), function (b) { b.setAttribute("aria-pressed", "false"); b.textContent = "🔊 Escuchar"; }); }
  function speakText(text, btn) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { setMsg("Tu navegador no puede leer en voz alta."); if (btn) btn.textContent = "Voz no disponible"; return; }
    stopSpeech(); var tk = ++speakToken, list = sentences(text.replace(/\s+/g, " ").trim()), i = 0;
    if (btn) { btn.setAttribute("aria-pressed", "true"); btn.textContent = "⏹ Detener"; }
    var v = voices.filter(function (x) { return x.voiceURI === cfg.voice; })[0] || voices[0];
    (function next() {
      if (tk !== speakToken) return; if (i >= list.length) { if (btn) { btn.setAttribute("aria-pressed", "false"); btn.textContent = "🔊 Escuchar"; } return; }
      var u = new SpeechSynthesisUtterance(list[i++]); u.lang = "es-ES"; if (v) u.voice = v; u.rate = cfg.rate || 1; u.onend = next; u.onerror = function () { if (tk === speakToken) next(); }; speechSynthesis.speak(u);
    })();
  }
  function plainOf(m) { var c = m.cloneNode(true); Array.prototype.forEach.call(c.querySelectorAll(".alma-src,.alma-tools"), function (n) { n.remove(); }); return c.textContent; }

  /* ---------- mensajes ---------- */
  function addMsg(cls, html) { var m = mk("div", { class: "alma-msg " + cls }); m.innerHTML = html; log.appendChild(m); log.scrollTop = log.scrollHeight; return m; }
  function userMsg(t) { var m = mk("div", { class: "alma-msg alma-msg--user" }); m.appendChild(mk("p", { text: t })); log.appendChild(m); log.scrollTop = log.scrollHeight; history.push({ role: "user", content: t }); persist(); }
  function tools(m) { if (m.querySelector(".alma-tools")) return; var d = mk("div", { class: "alma-tools" }, [mk("button", { type: "button", "data-listen": "", "aria-pressed": "false", text: "🔊 Escuchar" })]); m.appendChild(d); }
  function botMsg(html, srcs, plain, noTools) {
    var m = addMsg("alma-msg--bot", html); if (srcs && srcs.length) m.appendChild(srcList(srcs)); if (!noTools) tools(m);
    if (plain != null) { history.push({ role: "assistant", content: plain }); persist(); } if (cfg.autoread === "1" && !noTools) speakText(plainOf(m)); return m;
  }
  function srcList(srcs) { var d = mk("div", { class: "alma-src" }, ["Ir al texto: "]); srcs.forEach(function (s) { d.appendChild(mk("a", { href: base + s.u, text: s.label })); }); return d; }
  function persist() { if (cfg.remember !== "1") return; try { localStorage.setItem(HIST_KEY, JSON.stringify(history.slice(-30))); } catch (e) {} }
  function clearChat() { stopSpeech(); history = []; log.textContent = ""; try { localStorage.removeItem(HIST_KEY); } catch (e) {} welcome(); }
  function welcome() {
    if (cfg.remember === "1") { try { var h = JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); if (h.length) { history = h; h.forEach(function (m) { addMsg(m.role === "user" ? "alma-msg--user" : "alma-msg--bot", rich(m.content)); }); showChips(); return; } } catch (e) {} }
    var ctx = chapterContext(); botMsg('<p>Hola, soy <strong>ALMA</strong>, la guía de lectura de <em>Rutas del Alma</em>. ' + (ctx ? 'Veo que estás en <strong>' + esc(ctx.label) + '</strong>. ' : '') + 'Puedo buscar ideas en el texto, explicarte un capítulo, hablarte de los personajes, leértelo en voz alta o recomendarte por dónde seguir.</p><p>Respondo con el texto oficial del libro y te llevo al apartado donde aparece.</p>', null, null, true);
    showChips();
  }
  function showChips() {
    var ctx = chapterContext(), list = ctx && ctx.n > 0 ? ["Resume este capítulo", "¿Qué ejercicios hay aquí?", "Léeme este capítulo"] : ["¿Por dónde empiezo?", "¿De qué trata el libro?", "¿Quiénes son los personajes?"];
    list.push("¿Qué es la brújula dorada?"); chips.textContent = ""; list.forEach(function (t) { chips.appendChild(mk("button", { type: "button", text: t })); });
  }
  function chapterContext() {
    var m = page.match(/^capitulo-(\d\d)-/); if (m) { var n = parseInt(m[1], 10), c = chap(n); return { n: n, label: "el capítulo " + n + (c ? " · " + c.t : "") }; }
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
    var res = index.chunks.map(function (c) { var s = 0; qs.forEach(function (t) { if (c._tf[t]) s += (1 + Math.log(c._tf[t])) * index._idf(t); }); if (s && ctx && c.cap === ctx.n) s *= 1.25; if (c.s === "Epígrafe") s *= .6; if (c.cap === -5 || c.cap === -6) s *= .85; return { c: c, s: s }; })
      .filter(function (r) { return r.s > 1.6; }).sort(function (a, b) { return b.s - a.s; });
    return res.slice(0, k || 3).map(function (r) { return r.c; });
  }
  function excerpt(t, n) { n = n || 300; if (t.length <= n) return t; var cut = t.slice(0, n), i = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; ")); return (i > 120 ? cut.slice(0, i + 1) : cut.replace(/\s+\S*$/, "")) + " […]"; }
  function where(c) { return c.cap > 0 ? "Cap. " + c.cap + " · " : c.cap === 0 ? "Prólogo · " : ""; }
  function srcOf(c) { return { u: c.u, label: c.cap <= -5 ? c.s : where(c) + c.s.replace(/:.*/, "") }; }
  function dedupe(a) { var seen = {}; return a.filter(function (s) { if (seen[s.u]) return false; seen[s.u] = 1; return true; }); }

  /* ---------- intenciones sin IA ---------- */
  var CRISIS = /(suicid|matarme|quitarme la vida|quitarme de en medio|quiero morir|quisiera morir|querria morir|no quiero vivir|no quiero seguir viviendo|no vale la pena vivir|acabar con mi vida|acabar con todo|me quiero hacer dano|quiero hacerme dano|hacerme dano|hacerme algo malo|autolesi|cortarme las venas|desaparecer para siempre)/;
  function chNum(q) { var m = norm(q).match(/cap(?:itulo)?\.?\s*(\d)/); if (m) return parseInt(m[1], 10); if (/prologo/.test(norm(q))) return 0; var c = chapterContext(); return /(este|aqui|actual)/.test(norm(q)) && c ? c.n : null; }
  function startReader() {
    var f = document.querySelector('button[aria-controls="reader-panel"]'), p = document.getElementById("reader-panel"); if (!f || !p) return false;
    if (p.hidden) f.click(); var play = Array.prototype.filter.call(p.querySelectorAll("button"), function (b) { return /Escuchar p/.test(b.title || ""); })[0]; if (play) { play.click(); return true; } return false;
  }
  function localAnswer(q) {
    var n = norm(q), num = chNum(q);
    if (CRISIS.test(n)) return { html: "<p>Siento que estés pasando por algo tan difícil. Lo que cuentas es importante y no tienes que afrontarlo a solas.</p><p>Si estás en España, puedes llamar ahora al <strong>024</strong> (línea de atención a la conducta suicida) o al <strong>112</strong> si hay peligro inmediato. Si estás en otro país, contacta con tu servicio de emergencias local. También puedes hablar con alguien de confianza o con un profesional de la salud.</p><p>Este libro no sustituye la atención profesional.</p>", plain: "Mensaje de apoyo y recursos de ayuda." };
    if (/^(hola|buenas|hey|buenos dias|buenas tardes|buenas noches)\b/.test(n) && n.length < 30) return { html: "<p>¡Hola! ¿Qué te gustaría explorar del libro?</p>", plain: "Saludo" };
    if (/(que puedes hacer|como funciona|que haces)/.test(n) && n.length < 60 || /^ayuda\b/.test(n)) return { html: "<p>Puedo <strong>buscar en el texto oficial</strong>, <strong>resumir un capítulo</strong>, <strong>listar sus ejercicios</strong>, <strong>presentarte a los personajes</strong>, <strong>leértelo en voz alta</strong> y <strong>recomendarte por dónde seguir</strong>. Siempre te enlazo el apartado donde aparece. En ⚙ puedes cambiar mi estilo de respuesta y la voz.</p>", plain: "Capacidades" };
    if (/(leeme|lee el|lee este|leer el|leer este|leer en voz alta|en voz alta|reproduce|escuchar el cap|escuchar este)/.test(n)) {
      var ctx = chapterContext(); if (ctx && (num == null || num === ctx.n)) { var ok = startReader(); return { html: ok ? "<p>Empiezo a leer <strong>" + esc(ctx.label) + "</strong> con el lector de voz. Puedes pausarlo, avanzar o detenerlo desde sus controles.</p>" : "<p>Abre el lector de voz con el botón del altavoz y pulsa «Escuchar página».</p>", plain: "Lectura en voz alta" }; }
      if (num != null && chap(num)) return { html: "<p>Abre " + (num === 0 ? "el prólogo" : "el capítulo " + num) + " y pulsa «Escuchar página» en el lector de voz.</p>", src: [{ u: chap(num).f + "?leer=1", label: "Ir y abrir el lector" }], plain: "Lectura en voz alta" };
      return { html: "<p>Dime qué capítulo quieres escuchar (por ejemplo «léeme el capítulo 3») o abre uno y pídemelo desde allí.</p>", plain: "Lectura" };
    }
    if (/(por donde (empiezo|empezar|comienzo)|donde empiezo|recomiend|empezar a leer|que leo)/.test(n)) {
      var last = null; try { last = (JSON.parse(localStorage.getItem("rutas-lectura")) || {}).last; } catch (e) {}
      var h = "<p>Te sugiero seguir el orden del libro: empieza por el <strong>prólogo</strong> y continúa con el <strong>capítulo 1, El Jardín de la Mente</strong>. Cada capítulo tiene relato, reflexión, ejercicios y espacio para tus notas.</p>", s = [{ u: "prologo.html", label: "Prólogo" }, { u: "capitulo-01-el-jardin.html", label: "Capítulo 1" }];
      if (last && last.page) { h += "<p>Además, la última vez te quedaste en <strong>" + esc(last.title) + "</strong> (" + Math.round(last.pct * 100) + " %).</p>"; s.unshift({ u: last.page + "?continuar=1", label: "Continuar donde lo dejé" }); }
      return { html: h, src: s, plain: "Recomendación de lectura" };
    }
    if (/(resum|de que trata|trata de|sinopsis)/.test(n)) {
      if (num == null && /libro|obra|historia/.test(n)) { var cp = index.chunks.filter(function (c) { return c.s === "Contraportada"; }); if (cp.length) return { html: "<p>" + esc(cp.slice(0, 2).map(function (c) { return c.x; }).join(" ")) + "</p>", src: [{ u: "index.html", label: "Portada" }], plain: cp[0].x }; }
      if (num != null) { var ch = chap(num), st = index.chunks.filter(function (c) { return c.cap === num && c.s === "Relato"; }); if (ch && st.length) { var t = (num === 0 ? "<strong>Prólogo · " : "<strong>Capítulo " + num + " · ") + esc(ch.t) + "</strong>."; if (ch.ep) t += " Epígrafe: «" + esc(ch.ep) + "» — " + esc(ch.epa) + "."; t += "<p>Empieza así: " + esc(excerpt(st[0].x, 340)) + "</p>"; if (st.length > 1) t += "<p>Y termina con: " + esc(excerpt(st[st.length - 1].x.slice(-320), 320)) + "</p>"; return { html: t, src: [{ u: ch.f + "#relato", label: "Leer el relato" }], plain: "Resumen del capítulo " + num }; } }
    }
    var dm = n.match(/(?:que (?:es|son|significa|significan|quiere decir)|significado de|definicion de|definicion del)\s+(?:el |la |los |las |un |una )?([a-zñ]+(?: [a-zñ]+)?)/);
    if (dm) {
      var qt = toks(dm[1]), gl = index.chunks.filter(function (c) { return c.cap === -5 && qt.length && toks(c.s.replace("Glosario: ", "")).some(function (t) { return qt.indexOf(t) > -1; }); })[0];
      if (gl) { var bk = search(dm[1], 3).filter(function (c) { return c.cap >= 0; }); return { html: "<p><strong>" + esc(gl.s.replace("Glosario: ", "")) + "</strong> (definición general y sencilla; no es texto del libro): " + esc(gl.x.replace(/^[^.]*\. Definición general y sencilla \(no es texto del libro\): /, "")) + "</p>" + (bk.length ? "<p>En el libro aparece, por ejemplo, aquí:</p>" + bk.slice(0, 2).map(function (c) { return '<div class="alma-quote"><strong>' + esc(where(c) + c.s) + ":</strong> " + esc(excerpt(c.x, 220)) + "</div>"; }).join("") : ""), src: dedupe([{ u: "index.html", label: "Glosario" }].slice(0, 0).concat(bk.slice(0, 2).map(srcOf))), plain: gl.x }; }
    }
    if (/ejercicio/.test(n) && num != null && num > 0) { var ex = index.chunks.filter(function (c) { return c.cap === num && /^Ejercicio/.test(c.s); }); if (ex.length) return { html: "<p>En el capítulo " + num + " hay " + ex.length + " ejercicios:</p><p>" + ex.map(function (c) { return "• " + esc(c.s); }).join("<br>") + "</p><p>Puedes escribir tus respuestas debajo de cada uno; se guardan solo en tu dispositivo.</p>", src: [{ u: chap(num).f + "#ejercicios-libro", label: "Ir a los ejercicios" }], plain: "Ejercicios del capítulo " + num }; }
    if (/personaje/.test(n) && !/(quien es|quienes son)/.test(n) || /(quienes son|que personajes)/.test(n)) {
      var pj = index.chunks.filter(function (c) { return c.cap === -1; });
      return { html: "<p>Los personajes principales son: " + pj.map(function (c) { return "<strong>" + esc(c.s.replace("Personaje: ", "")) + "</strong>"; }).join(", ") + ". Pregúntame por cualquiera de ellos.</p>", src: [{ u: "personajes.html", label: "Galería de personajes" }], plain: "Lista de personajes" };
    }
    var nm = index.chunks.filter(function (c) { return c.cap === -1 && toks(c.s.replace("Personaje: ", "")).some(function (t) { return toks(q).indexOf(t) > -1; }); });
    if (nm.length && /(quien|personaje|cuent|habl)/.test(n) && nm.length <= 2) return { html: nm.map(function (c) { return "<p>" + esc(c.x) + "</p>"; }).join(""), src: nm.map(function (c) { return { u: c.u, label: c.s.replace("Personaje: ", "Ficha de ") }; }), plain: nm[0].x };
    return null;
  }
  function localSearch(q) {
    var P = PROFILES[cfg.profile], kk = Math.max(1, P.k - (cfg.length === "corta" ? 1 : 0) + (cfg.length === "larga" ? 1 : 0)), xx = Math.round(P.x * (cfg.length === "corta" ? .7 : cfg.length === "larga" ? 1.4 : 1)), hits = search(q, kk);
    if (!hits.length) return { html: "<p>No he encontrado nada claro sobre eso en el texto del libro. Prueba con otras palabras o pregúntame por un capítulo, un personaje o un ejercicio.</p>", plain: "Sin resultados" };
    var h = "<p>" + esc(P.intro) + "</p>" + hits.map(function (c) { var glos = c.cap === -5; return '<div class="alma-quote"><strong>' + esc(where(c) + c.s) + (glos ? " (definición general, no es texto del libro)" : "") + ":</strong> " + esc(excerpt(c.x.replace(/^[^.]*\. Definición general y sencilla \(no es texto del libro\): /, ""), xx)) + "</div>"; }).join("");
    return { html: h, src: dedupe(hits.map(srcOf)), plain: hits.map(function (c) { return c.x; }).join(" ") };
  }

  /* ---------- proveedores y detección ---------- */
  function withTimeout(ms) { var c = new AbortController(), t = setTimeout(function () { c.abort(); }, ms); return { signal: c.signal, done: function () { clearTimeout(t); } }; }
  function getJson(url, headers) { var w = withTimeout(1800); return fetch(url, { signal: w.signal, headers: headers || {} }).then(function (r) { w.done(); if (!r.ok) throw new Error("http " + r.status); return r.json(); }).catch(function (e) { w.done(); throw e; }); }
  function pickModel(ms) { var ok = ms.filter(function (m) { return !/embed|nomic|bge|whisper|tts|rerank/i.test(m); }); return ok.filter(function (m) { return /qwen|llama|gemma|mistral|phi/i.test(m); })[0] || ok[0] || null; }
  function listOllama(url) { return getJson(url + "/api/tags").then(function (j) { return (j.models || []).map(function (m) { return m.name; }); }); }
  function listOpenAI(url, tok) { return getJson(url + "/v1/models", tok ? { Authorization: "Bearer " + tok } : {}).then(function (j) { return (j.data || []).map(function (m) { return m.id; }); }); }
  function probes() {
    var list = [
      { key: "packaged", label: "Paquete local (modelos-ia/)", run: function () { return getJson(base + "modelos-ia/manifest.json").then(function (m) { if (!m || !m.runtime || !safeUrl(m.runtime.endpoint) || !(m.models || []).length) throw new Error("vacío"); var u = safeUrl(m.runtime.endpoint); return listOpenAI(u).then(function (ms) { return { provider: "packaged", url: u, models: ms.length ? ms : m.models.map(function (x) { return x.id; }) }; }); }); }, miss: "No hay paquete configurado (modelos-ia/manifest.json sin modelos) o su servicio no responde." },
      { key: "ollama", label: "Ollama (" + (cfg.provider === "ollama" && safeUrl(cfg.url) || DEF.url) + ")", run: function () { var u = cfg.provider === "ollama" && safeUrl(cfg.url) || DEF.url; return listOllama(u).then(function (ms) { return { provider: "ollama", url: u, models: ms }; }); }, miss: "No responde. ¿Está en marcha y permite este origen (OLLAMA_ORIGINS)?" },
      { key: "antigravity", label: "Antigravity", run: null, info: "No se puede detectar desde el navegador: es un entorno de desarrollo con agentes que se integra por MCP, no un servidor de inferencia. Si expone una API compatible con OpenAI, configúrala como «Servidor local compatible»." }
    ];
    [["LM Studio", "http://localhost:1234"], ["llama.cpp / LocalAI", "http://localhost:8080"], ["Servidor compatible", "http://localhost:8000"]].forEach(function (x) {
      list.push({ key: "openai", label: x[0] + " (" + x[1] + ")", run: function () { return listOpenAI(x[1]).then(function (ms) { return { provider: "openai", url: x[1], models: ms }; }); }, miss: "No responde." });
    });
    list.push({ key: "external", label: "Proveedor externo", run: (SITE.allowExternal !== false && cfg.extOk === "1" && /^https:/.test(cfg.extUrl)) ? function () { var u = safeUrl(cfg.extUrl); return listOpenAI(u, sessionToken).then(function (ms) { return { provider: "external", url: u, models: ms }; }); } : null, info: "Desactivado: solo se prueba si lo habilitas expresamente en «Avanzado».", miss: "No responde o rechaza la clave." });
    return list;
  }
  function runDetect(silent) {
    if (cfg.consent !== "1") { if (silent) return; if (!window.confirm("ALMA va a probar conexiones con servidores de tu propio equipo (localhost) para buscar modelos de IA. No se envía ningún mensaje ni contenido. ¿Continuar?")) { setMsg("Búsqueda cancelada."); return; } cfg.consent = "1"; saveCfg(); }
    var ps = probes(), rep = panel.querySelector(".alma-report"); if (rep) rep.textContent = ""; setMsg("Buscando modelos…");
    return Promise.all(ps.map(function (p) { if (!p.run) return Promise.resolve({ p: p, status: "info" }); return p.run().then(function (r) { return { p: p, status: r.models.length ? "ok" : "empty", r: r }; }).catch(function () { return { p: p, status: "miss" }; }); })).then(function (res) {
      var best = null, seen = {}, wantAuto = ($("alma-prov") ? $("alma-prov").value : cfg.provider) === "auto";
      res.forEach(function (x) { if (x.status === "ok") { var key = x.r.url.replace("localhost", "127.0.0.1"); if (seen[key]) { x.status = "info"; x.p = { label: x.p.label, info: "Es el mismo servicio que el anterior." }; return; } seen[key] = 1; if (!best) { var m = pickModel(x.r.models); if (m) best = { provider: x.r.provider, url: x.r.url, model: m }; } } });
      lastReport = res;
      if (rep) res.forEach(function (x, i) {
        var t = (i + 1) + ". " + x.p.label + " — " + (x.status === "ok" ? "disponible (" + x.r.models.slice(0, 4).join(", ") + (x.r.models.length > 4 ? "…" : "") + ")" : x.status === "empty" ? "responde, pero no hay modelos instalados" : x.status === "info" ? x.p.info : x.p.miss);
        rep.appendChild(mk("li", { text: t, "data-s": x.status }));
      });
      var dl = panel.querySelector("#alma-models"); if (dl) { dl.textContent = ""; res.forEach(function (x) { if (x.status === "ok") x.r.models.forEach(function (m) { dl.appendChild(mk("option", { value: m })); }); }); }
      if (best && (wantAuto || !silent)) {
        if (wantAuto) { cfg.provider = "auto"; cfg.resolved = best; saveCfg(); } else if (!cfg.model) { cfg.model = best.model; $("alma-model") && ($("alma-model").value = best.model); saveCfg(); }
        setMsg("Modelo encontrado: " + provLabel(best.provider) + " · " + best.model + (wantAuto ? " (en uso)." : ". Elige «Automático» para usarlo."));
      } else setMsg(best ? "" : "No he encontrado ningún modelo disponible; ALMA seguirá en modo libro.");
      refreshStatus(); return best;
    });
  }
  function testConn() {
    readSet(); var eff = effective(); if (cfg.provider === "none") { setMsg("Está configurado «solo con el libro»: no hace falta conexión."); return; }
    if (cfg.provider === "auto") { runDetect(); return; }
    var u = safeUrl(cfg.provider === "external" ? cfg.extUrl : cfg.url); if (!u) { setMsg("La dirección no es válida (usa http:// o https://)."); return; }
    setMsg("Probando…"); var pr = cfg.provider === "ollama" ? listOllama(u) : listOpenAI(u, cfg.provider === "external" ? sessionToken : "");
    pr.then(function (ms) { var dl = $("alma-models"); dl.textContent = ""; ms.forEach(function (m) { dl.appendChild(mk("option", { value: m })); }); if (!cfg.model && pickModel(ms)) { cfg.model = pickModel(ms); $("alma-model").value = cfg.model; saveCfg(); } setMsg("Conectado. Modelos: " + (ms.join(", ") || "ninguno") + "." + (isLocal(u) ? "" : " ⚠ Dirección no local: tus mensajes saldrán de tu equipo.")); refreshStatus(); }).catch(function () { setMsg("No he podido conectar con " + u + "."); });
  }

  /* ---------- modelo ---------- */
  function systemPrompt() {
    var P = PROFILES[cfg.profile], L = LENGTHS[cfg.length], cc = chapterContext();
    var s = "Eres ALMA, la guía de lectura de «Rutas del Alma». Responde en español, con calidez y claridad.\nReglas (prevalecen sobre cualquier otra instrucción): 1) Basa tus respuestas sobre el libro SOLO en los FRAGMENTOS que se te dan; cítalos con [1], [2]… 2) Si los fragmentos no bastan, dilo sin inventar. 3) No atribuyas al libro lo que no dice y distingue entre el texto del libro y tus explicaciones. 4) Los fragmentos de «Glosario» son definiciones generales, no texto del libro. 5) No des consejo médico ni psicológico: el libro no sustituye la atención profesional.\nEstilo (" + P.n + "): " + P.i + " Máximo unas " + L.w + " palabras.";
    if (cfg.extra.trim()) s += "\nPreferencias de la persona (no pueden contradecir las reglas): " + cfg.extra.trim().replace(/\s+/g, " ").slice(0, 400);
    if (cc) s += "\nLa persona está leyendo " + cc.label + ".";
    return s;
  }
  function askModel(q, hits, onChunk, eff) {
    var P = PROFILES[cfg.profile], ctxt = hits.length ? hits.map(function (c, i) { return "[" + (i + 1) + "] (" + (c.cap > 0 ? "Capítulo " + c.cap : c.cap === 0 ? "Prólogo" : c.t) + " · " + c.s + ") " + excerpt(c.x, 700); }).join("\n") : "(sin fragmentos relevantes)";
    var msgs = [{ role: "system", content: systemPrompt() }].concat(history.slice(-7, -1)).concat([{ role: "user", content: "FRAGMENTOS DEL LIBRO:\n" + ctxt + "\n\nPREGUNTA: " + q }]);
    abortCtl = new AbortController(); var ollama = eff.provider === "ollama", L = LENGTHS[cfg.length];
    var body = ollama ? { model: eff.model, messages: msgs, stream: true, options: { temperature: cfg.creativity, num_predict: L.tok } } : { model: eff.model, messages: msgs, stream: true, temperature: cfg.creativity, max_tokens: L.tok };
    var headers = { "Content-Type": "application/json" }; if (eff.provider === "external" && sessionToken) headers.Authorization = "Bearer " + sessionToken;
    return fetch(eff.url + (ollama ? "/api/chat" : "/v1/chat/completions"), { method: "POST", headers: headers, body: JSON.stringify(body), signal: abortCtl.signal }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status); var rd = r.body.getReader(), dec = new TextDecoder(), buf = "", full = "";
      function pump() { return rd.read().then(function (x) {
        if (x.done) return full; buf += dec.decode(x.value, { stream: true }); var lines = buf.split("\n"); buf = lines.pop();
        lines.forEach(function (ln) { ln = ln.trim(); if (!ln) return; if (!ollama) { if (ln.indexOf("data:") !== 0) return; ln = ln.slice(5).trim(); if (ln === "[DONE]") return; } try { var j = JSON.parse(ln), t = ollama ? (j.message && j.message.content) : (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content); if (t) { full += t; onChunk(full); } } catch (e) {} });
        return pump(); }); }
      return pump();
    });
  }
  function setBusy(b) { busy = b; send.textContent = b ? "Detener" : "Enviar"; send.setAttribute("data-stop", b ? "1" : "0"); }
  function ask(q) {
    userMsg(q); chips.textContent = ""; ensureIndex(function () {
      var la = localAnswer(q); if (la) { botMsg(la.html, la.src, la.plain); return; }
      var eff = effective(); if (!eff) { var r = localSearch(q); botMsg(r.html, r.src, r.plain); return; }
      if (eff.provider === "external" && !isLocal(eff.url) && cfg.extOk !== "1") { var r0 = localSearch(q); botMsg(r0.html, r0.src, r0.plain); return; }
      var hits = search(q, PROFILES[cfg.profile].k + 1), m = botMsg('<p class="alma-typing">Pensando</p>', null, null, true); setBusy(true);
      askModel(q, hits, function (t) { m.innerHTML = rich(t); log.scrollTop = log.scrollHeight; }, eff).then(function (full) {
        if (!full) m.innerHTML = rich("No he recibido respuesta del modelo."); history.push({ role: "assistant", content: full || "" }); persist();
        if (hits.length) m.appendChild(srcList(dedupe(hits.map(srcOf)))); tools(m); setBusy(false); log.scrollTop = log.scrollHeight; if (cfg.autoread === "1") speakText(plainOf(m));
      }).catch(function (err) {
        setBusy(false); if (err && err.name === "AbortError") { m.appendChild(mk("p", { html: "<em>(respuesta detenida)</em>" })); return; }
        m.className = "alma-msg alma-msg--err"; m.innerHTML = "<p><strong>No he podido hablar con el modelo.</strong> Comprueba que el servidor está en marcha, que el nombre del modelo es correcto y que permite este origen (en Ollama, <code>OLLAMA_ORIGINS</code>).</p><p>Mientras tanto, te respondo con el libro:</p>";
        var r2 = localSearch(q), tmp = mk("div"); tmp.innerHTML = r2.html; while (tmp.firstChild) m.appendChild(tmp.firstChild); if (r2.src) m.appendChild(srcList(r2.src)); tools(m);
      });
    });
  }

  function init() { build(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
