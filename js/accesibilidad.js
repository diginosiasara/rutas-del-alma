/* Mi lectura: preferencias de accesibilidad persistentes (localStorage, solo en este dispositivo). */
(function () {
  "use strict";
  var KEY = "rutas-reading-preferences";
  var DEF = { size: "0", font: "original", lh: "0", ls: "0", width: "normal", bg: "original", palette: "original", motion: "auto", underline: "0", justify: "0", focus: "0", ruler: "0" };
  var OPT = {
    size: ["0", "1", "2", "3", "4"], font: ["original", "verdana", "arial"], lh: ["0", "1", "2"], ls: ["0", "1", "2"], width: ["narrow", "normal", "wide"],
    bg: ["original", "crema", "sepia", "gris", "oscuro", "contraste"], palette: ["original", "azul", "mono"], motion: ["auto", "reduce"],
    underline: ["0", "1"], justify: ["0", "1"], focus: ["0", "1"], ruler: ["0", "1"]
  };
  var prefs = load();
  var root = document.documentElement;

  function load() {
    var p = {}, k, raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { raw = null; }
    for (k in DEF) p[k] = (raw && OPT[k].indexOf(String(raw[k])) > -1) ? String(raw[k]) : DEF[k];
    return p;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* almacenamiento bloqueado */ } }
  function apply() {
    var m = { size: "data-a-size", font: "data-a-font", lh: "data-a-lh", ls: "data-a-ls", width: "data-a-width", bg: "data-a-bg", palette: "data-a-palette", motion: "data-a-motion", underline: "data-a-underline", justify: "data-a-justify", focus: "data-a-focus" };
    Object.keys(m).forEach(function (k) {
      var def = DEF[k];
      if (prefs[k] === def || (k === "motion" && prefs[k] === "auto")) root.removeAttribute(m[k]); else root.setAttribute(m[k], prefs[k]);
    });
    if (ruler) ruler.hidden = prefs.ruler !== "1";
  }
  apply();

  var ruler = null, panel, fab, status, lastFocus;
  var GROUPS = [
    ["size", "Tamaño de letra", [["0", "Normal"], ["1", "Grande"], ["2", "Más grande"], ["3", "Muy grande"], ["4", "Extra"]]],
    ["font", "Tipografía", [["original", "Original"], ["verdana", "Verdana"], ["arial", "Arial"]]],
    ["lh", "Interlineado", [["0", "Normal"], ["1", "Amplio"], ["2", "Extra amplio"]]],
    ["ls", "Espaciado de letras y palabras", [["0", "Normal"], ["1", "Ampliado"], ["2", "Muy ampliado"]]],
    ["width", "Ancho de lectura", [["narrow", "Estrecho"], ["normal", "Normal"], ["wide", "Amplio"]]],
    ["bg", "Fondo de lectura", [["original", "Original"], ["crema", "Crema"], ["sepia", "Sepia"], ["gris", "Gris"], ["oscuro", "Oscuro"], ["contraste", "Alto contraste"]]],
    ["palette", "Colores de acento (daltonismo)", [["original", "Original"], ["azul", "Azul y naranja"], ["mono", "Monocromo"]]]
  ];
  var CHECKS = [
    ["underline", "Subrayar siempre los enlaces"],
    ["justify", "Texto justificado (por defecto, alineado a la izquierda)"],
    ["focus", "Modo sin distracciones: oculta decoración y material complementario"],
    ["ruler", "Regla de lectura que sigue al puntero y al foco"]
  ];

  function say(t) { if (status) { status.textContent = ""; setTimeout(function () { status.textContent = t; }, 30); } }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }

  function build() {
    fab = el("button", { type: "button", class: "a-fab", "aria-expanded": "false", "aria-controls": "a-panel", title: "Mi lectura: ajustes de accesibilidad (Alt + Mayús + A)", "aria-label": "Mi lectura: ajustes de accesibilidad" }, '<span aria-hidden="true">Aa</span>');
    panel = el("section", { id: "a-panel", class: "a-panel", role: "dialog", "aria-modal": "false", "aria-labelledby": "a-title", hidden: "" });
    var h = '<div class="a-panel__head"><h2 id="a-title">Mi lectura</h2><button type="button" class="a-close">Cerrar</button></div>';
    GROUPS.forEach(function (g) {
      h += '<fieldset><legend>' + g[1] + '</legend><div class="a-seg">';
      g[2].forEach(function (o) {
        h += '<label><input type="radio" name="a-' + g[0] + '" value="' + o[0] + '"' + (prefs[g[0]] === o[0] ? " checked" : "") + '><span>' + o[1] + '</span></label>';
      });
      h += '</div></fieldset>';
    });
    h += '<div class="a-checks">';
    CHECKS.forEach(function (c) { h += '<label><input type="checkbox" name="a-' + c[0] + '"' + (prefs[c[0]] === "1" ? " checked" : "") + '><span>' + c[1] + '</span></label>'; });
    h += '<label><input type="checkbox" name="a-motion"' + (prefs.motion === "reduce" ? " checked" : "") + '><span>Reducir animaciones y movimiento</span></label></div>';
    h += '<p class="a-note">Tus ajustes se guardan solo en este navegador y dispositivo. No se envían a ningún servidor.</p>';
    h += '<button type="button" class="a-reset">Restablecer todo</button>';
    panel.innerHTML = h;
    status = el("p", { class: "sr-only", role: "status", "aria-live": "polite" });
    ruler = el("div", { class: "a-ruler", "aria-hidden": "true" }); ruler.hidden = prefs.ruler !== "1";
    document.body.appendChild(fab); document.body.appendChild(panel); document.body.appendChild(status); document.body.appendChild(ruler);

    fab.addEventListener("click", function () { panel.hidden ? open() : close(); });
    panel.querySelector(".a-close").addEventListener("click", close);
    panel.querySelector(".a-reset").addEventListener("click", function () {
      prefs = {}; for (var k in DEF) prefs[k] = DEF[k]; save(); apply(); sync(); say("Ajustes restablecidos");
    });
    panel.addEventListener("change", function (e) {
      var t = e.target, n = (t.name || "").replace("a-", "");
      if (t.type === "radio") prefs[n] = t.value;
      else if (n === "motion") prefs.motion = t.checked ? "reduce" : "auto";
      else prefs[n] = t.checked ? "1" : "0";
      save(); apply();
      var lab = t.closest("label"); say((lab ? lab.textContent.trim() : n) + (t.type === "checkbox" ? (t.checked ? ": activado" : ": desactivado") : ": seleccionado"));
    });
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); close(); return; }
      if (e.key !== "Tab") return;
      var f = panel.querySelectorAll("input,button"); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }
  function sync() {
    panel.querySelectorAll("input[type=radio]").forEach(function (r) { r.checked = prefs[r.name.replace("a-", "")] === r.value; });
    panel.querySelectorAll("input[type=checkbox]").forEach(function (c) { var n = c.name.replace("a-", ""); c.checked = n === "motion" ? prefs.motion === "reduce" : prefs[n] === "1"; });
  }
  function open() { lastFocus = document.activeElement; panel.hidden = false; fab.setAttribute("aria-expanded", "true"); var f = panel.querySelector("input:checked") || panel.querySelector("input"); if (f) f.focus(); }
  function close() { panel.hidden = true; fab.setAttribute("aria-expanded", "false"); fab.focus(); }

  function moveRuler(y) { if (ruler && prefs.ruler === "1") ruler.style.top = Math.max(0, y - ruler.offsetHeight / 2) + "px"; }
  function init() {
    build(); apply();
    document.addEventListener("mousemove", function (e) { moveRuler(e.clientY); }, { passive: true });
    document.addEventListener("touchmove", function (e) { if (e.touches[0]) moveRuler(e.touches[0].clientY); }, { passive: true });
    document.addEventListener("focusin", function (e) { if (panel.contains(e.target) || !e.target.getBoundingClientRect) return; var r = e.target.getBoundingClientRect(); moveRuler(r.top + r.height / 2); });
    document.addEventListener("keydown", function (e) { if (e.altKey && e.shiftKey && (e.key === "A" || e.key === "a")) { e.preventDefault(); panel.hidden ? open() : close(); } });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
