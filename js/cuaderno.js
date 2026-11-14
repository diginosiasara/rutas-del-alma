/* Cuaderno personal: respuestas a los ejercicios del libro.
   Todo se guarda solo en este dispositivo (localStorage); nada se envía a ningún servidor. */
(function () {
  "use strict";
  var KEY = "rutas-cuaderno:v1";
  var CHAPTERS = [{"n": 1, "file": "capitulo-01-el-jardin.html", "title": "El Jardín de la Mente", "count": 2}, {"n": 2, "file": "capitulo-02-el-sauce.html", "title": "El Sauce del Reflejo", "count": 2}, {"n": 3, "file": "capitulo-03-la-luz.html", "title": "La Luz Interior", "count": 3}, {"n": 4, "file": "capitulo-04-las-llaves.html", "title": "Las Llaves del Pensamiento", "count": 3}, {"n": 5, "file": "capitulo-05-historias-ocultas.html", "title": "El Despertar de las Historias Ocultas", "count": 2}, {"n": 6, "file": "capitulo-06-grano-y-paja.html", "title": "El Grano y la Paja de la Historia", "count": 2}, {"n": 7, "file": "capitulo-07-libro-vivo.html", "title": "El Libro Vivo y la Brújula Dorada", "count": 2}, {"n": 8, "file": "capitulo-08-suenos.html", "title": "Sueños Paralelos y Revelaciones Internas", "count": 3}, {"n": 9, "file": "capitulo-09-regreso-nomadas.html", "title": "El Regreso de las Historias y el Circo de los Nómadas", "count": 2}];
  var CUADERNO_COUNT = 5;
  var page = location.pathname.split("/").pop() || "index.html";
  var m = page.match(/^capitulo-(\d\d)-/);
  var chapKey = m ? "cap" + m[1] : (page === "cuaderno-bibliografia.html" ? "cuaderno" : null);
  if (!chapKey) return;
  var chapInfo = m ? CHAPTERS.filter(function (c) { return c.n === parseInt(m[1], 10); })[0] : null;
  var list = document.querySelector(chapKey === "cuaderno" ? "#cuaderno .ejercicios-libro" : "#ejercicios-libro .ejercicios-libro");
  if (!list) return;

  var store = null, data = {};
  try { store = window.localStorage; store.getItem(KEY); data = JSON.parse(store.getItem(KEY) || "{}") || {}; } catch (e) { store = null; data = {}; }
  function persist() { if (!store) return false; try { store.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; } }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function two(n) { return n < 10 ? "0" + n : "" + n; }
  function clock() { var d = new Date(); return two(d.getHours()) + ":" + two(d.getMinutes()); }
  function chapName(key) { if (key === "cuaderno") return "Cuaderno de práctica"; var n = parseInt(key.slice(3), 10); var c = CHAPTERS.filter(function (x) { return x.n === n; })[0]; return c ? "Capítulo " + n + " · " + c.title : key; }

  var status = el("p", { class: "cn-status", role: "status", "aria-live": "polite" });
  function say(t) { status.textContent = ""; setTimeout(function () { status.textContent = t; }, 30); }

  var cards = list.querySelectorAll(".card");
  var fields = [];
  Array.prototype.forEach.call(cards, function (card, i) {
    var id = chapKey + "-ej" + (i + 1);
    var h3 = card.querySelector("h3"); var title = h3 ? h3.textContent.replace(/^\s*\d+\s*/, "").trim() : "Ejercicio " + (i + 1);
    var tid = "cn-" + id;
    var box = el("div", { class: "cn-box" });
    var label = el("label", { for: tid, class: "cn-label" }, "Mis notas");
    var ta = el("textarea", { id: tid, rows: "4", "data-cn": id, "aria-describedby": "cn-privacidad" });
    var cnt = el("p", { class: "cn-count" }, '<span data-n>0</span> caracteres');
    box.appendChild(label); box.appendChild(ta); box.appendChild(cnt); card.appendChild(box);
    if (data[id] && typeof data[id].t === "string") ta.value = data[id].t;
    cnt.querySelector("[data-n]").textContent = ta.value.length;
    var timer = null;
    ta.addEventListener("input", function () {
      cnt.querySelector("[data-n]").textContent = ta.value.length;
      status.textContent = store ? "Guardando…" : "";
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (ta.value.trim()) data[id] = { t: ta.value, ts: Date.now(), c: chapName(chapKey), h: (i + 1) + ". " + title }; else delete data[id];
        if (persist()) status.textContent = "Guardado a las " + clock() + "."; else status.textContent = "No se ha podido guardar en este navegador.";
        refreshSummary();
      }, 400);
    });
    fields.push({ id: id, ta: ta, cnt: cnt });
  });

  /* barra de herramientas */
  var tools = el("div", { class: "cn-tools" });
  tools.innerHTML = '<p id="cn-privacidad" class="cn-privacy">Tus respuestas se guardan <strong>solo en este navegador y dispositivo</strong>. Si borras los datos del sitio, cambias de navegador o de dispositivo, no estarán. Haz una copia de seguridad para conservarlas.</p>' +
    '<div class="cn-buttons"><button type="button" data-act="txt">Descargar mis respuestas (.txt)</button><button type="button" data-act="json">Copia de seguridad (.json)</button>' +
    '<button type="button" data-act="import">Importar copia</button><button type="button" data-act="print">Imprimir</button><button type="button" data-act="clear">Borrar respuestas de esta página</button></div>' +
    '<input type="file" accept="application/json,.json" data-file hidden>';
  if (!store) tools.insertAdjacentHTML("afterbegin", '<p class="cn-warn" role="alert">Tu navegador bloquea el almacenamiento local: puedes escribir, pero las respuestas no se guardarán al cerrar la página. Descárgalas antes de salir.</p>');
  tools.appendChild(status);
  list.insertAdjacentElement("afterend", tools);

  function download(name, text, type) {
    var blob = new Blob([text], { type: type + ";charset=utf-8" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function currentData() { fields.forEach(function (f) { if (f.ta.value.trim() && !data[f.id]) data[f.id] = { t: f.ta.value, ts: Date.now(), c: chapName(chapKey), h: f.id }; }); return data; }
  function exportTxt() {
    var d = currentData(), keys = Object.keys(d).sort(function (a, b) { var pa = a.match(/^(cap\d+|cuaderno)-ej(\d+)$/), pb = b.match(/^(cap\d+|cuaderno)-ej(\d+)$/); if (!pa || !pb) return a < b ? -1 : 1; if (pa[1] !== pb[1]) return pa[1] < pb[1] ? -1 : 1; return pa[2] - pb[2]; });
    if (!keys.length) { say("Todavía no has escrito ninguna respuesta."); return; }
    var now = new Date(), out = "RUTAS DEL ALMA — Mi cuaderno\nExportado el " + two(now.getDate()) + "/" + two(now.getMonth() + 1) + "/" + now.getFullYear() + "\nContiene solo lo que escribiste en este dispositivo.\n", last = "";
    keys.forEach(function (k) { var e = d[k]; if (e.c !== last) { out += "\n== " + e.c + " ==\n"; last = e.c; } out += "\n" + e.h + "\n" + e.t + "\n"; });
    download("mi-cuaderno-rutas-del-alma.txt", out, "text/plain"); say("Descarga preparada: mi-cuaderno-rutas-del-alma.txt");
  }
  function exportJson() {
    var d = currentData(); if (!Object.keys(d).length) { say("Todavía no has escrito ninguna respuesta."); return; }
    download("copia-cuaderno-rutas-del-alma.json", JSON.stringify({ app: "rutas-del-alma", version: 1, exported: new Date().toISOString(), entries: d }, null, 2), "application/json");
    say("Copia de seguridad descargada.");
  }
  function importJson(file) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var j = JSON.parse(r.result); if (!j || j.app !== "rutas-del-alma" || typeof j.entries !== "object") throw new Error("formato");
        var n = 0;
        Object.keys(j.entries).forEach(function (k) { var e = j.entries[k]; if (!/^(cap\d\d|cuaderno)-ej\d+$/.test(k) || !e || typeof e.t !== "string") return; var cur = data[k]; if (!cur || (e.ts || 0) > (cur.ts || 0)) { data[k] = { t: e.t.slice(0, 20000), ts: e.ts || Date.now(), c: String(e.c || "").slice(0, 120), h: String(e.h || "").slice(0, 160) }; n++; } });
        persist(); fields.forEach(function (f) { f.ta.value = data[f.id] ? data[f.id].t : ""; f.cnt.querySelector("[data-n]").textContent = f.ta.value.length; });
        refreshSummary(); say(n ? "Copia importada: " + n + " respuestas recuperadas." : "La copia no contenía respuestas más recientes que las actuales.");
      } catch (e) { say("No se ha podido leer el archivo. Comprueba que es una copia de seguridad de Rutas del Alma."); }
    };
    r.readAsText(file);
  }
  var fileInput = tools.querySelector("[data-file]");
  fileInput.addEventListener("change", function () { if (fileInput.files[0]) importJson(fileInput.files[0]); fileInput.value = ""; });
  tools.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-act]"); if (!b) return; var a = b.getAttribute("data-act");
    if (a === "txt") exportTxt(); else if (a === "json") exportJson(); else if (a === "import") fileInput.click(); else if (a === "print") window.print();
    else if (a === "clear") {
      var any = fields.some(function (f) { return f.ta.value; }); if (!any) { say("No hay respuestas que borrar en esta página."); return; }
      if (!window.confirm("¿Borrar todas tus respuestas de esta página? No se puede deshacer. Si quieres conservarlas, descarga antes una copia.")) return;
      fields.forEach(function (f) { f.ta.value = ""; f.cnt.querySelector("[data-n]").textContent = "0"; delete data[f.id]; }); persist(); refreshSummary(); say("Respuestas borradas."); fields[0].ta.focus();
    }
  });

  /* resumen en la página del cuaderno */
  var summary = null;
  function refreshSummary() {
    if (!summary) return;
    var total = 0, done = 0, rows = "";
    CHAPTERS.forEach(function (c) { var d = 0; for (var i = 1; i <= c.count; i++) if (data["cap" + two(c.n) + "-ej" + i]) d++; total += c.count; done += d;
      rows += '<li><a href="' + c.file + '#ejercicios-libro">Capítulo ' + c.n + ' · ' + c.title + '</a><span>' + d + ' de ' + c.count + '</span></li>'; });
    var dc = 0; for (var j = 1; j <= CUADERNO_COUNT; j++) if (data["cuaderno-ej" + j]) dc++;
    total += CUADERNO_COUNT; done += dc;
    rows += '<li><a href="#cuaderno">Cuaderno de práctica</a><span>' + dc + ' de ' + CUADERNO_COUNT + '</span></li>';
    summary.innerHTML = '<h2 id="cn-res-t" class="title title--sm">Mi progreso</h2><p class="cn-total"><strong>' + done + ' de ' + total + '</strong> ejercicios con respuesta guardada en este dispositivo.</p><progress max="' + total + '" value="' + done + '" aria-label="Ejercicios con respuesta"></progress><ul class="cn-lista">' + rows + '</ul>';
  }
  if (chapKey === "cuaderno") {
    var sec = el("section", { id: "mi-progreso", class: "section section--plain", "aria-labelledby": "cn-res-t" });
    var inner = el("div", { class: "container--read" }); summary = el("div", { class: "cn-resumen" }); inner.appendChild(summary); sec.appendChild(inner);
    var anchor = document.getElementById("cuaderno"); anchor.parentNode.insertBefore(sec, anchor.nextSibling); refreshSummary();
  }
})();
