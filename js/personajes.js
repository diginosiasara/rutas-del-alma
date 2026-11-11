/* Galería de personajes: búsqueda y filtro por grupo (sin dependencias). */
(function () {
  "use strict";
  var grid = document.getElementById("char-grid");
  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.children);
  var input = document.getElementById("char-search");
  var chips = Array.prototype.slice.call(document.querySelectorAll(".char-filters .chip"));
  var count = document.getElementById("char-count");
  var empty = document.getElementById("char-empty");
  var group = "", timer = null;
  function apply() {
    var q = (input.value || "").trim().toLowerCase(), n = 0;
    cards.forEach(function (c) {
      var ok = (!group || c.dataset.group === group) && (!q || c.dataset.text.indexOf(q) > -1);
      c.hidden = !ok; if (ok) n++;
    });
    empty.hidden = n > 0;
    count.textContent = n === 1 ? "1 personaje mostrado." : n + " personajes mostrados.";
  }
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      group = chip.dataset.filter;
      chips.forEach(function (c) { c.setAttribute("aria-pressed", c === chip ? "true" : "false"); });
      apply();
    });
  });
  input.addEventListener("input", function () { window.clearTimeout(timer); timer = window.setTimeout(apply, 120); });
  apply(); count.textContent = "";
})();
