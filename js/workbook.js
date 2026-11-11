/* Workbook "Escribe tus llaves": borrador local, contador y borrado.
   Todo se guarda solo en este dispositivo (localStorage); no se envía a ningún servidor. */
(function () {
  "use strict";
  var KEY = "ruta-del-alma:cap04:";
  var fields = Array.prototype.slice.call(document.querySelectorAll("textarea[data-wb]"));
  if (!fields.length) return;
  var status = document.querySelector("[data-wb-status]");
  var clear = document.querySelector("[data-wb-clear]");
  var store = null;
  try { store = window.localStorage; store.getItem(KEY + "probe"); } catch (e) { store = null; }

  function count(field) {
    var out = field.parentNode.querySelector("[data-count]");
    if (out) out.textContent = String(field.value.length);
  }
  function say(msg) { if (status) { status.textContent = ""; window.setTimeout(function () { status.textContent = msg; }, 50); } }

  fields.forEach(function (field) {
    var timer = null;
    if (store) { try { var saved = store.getItem(KEY + field.dataset.wb); if (saved) field.value = saved; } catch (e) {} }
    count(field);
    field.addEventListener("input", function () {
      count(field);
      if (!store) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { try { store.setItem(KEY + field.dataset.wb, field.value); } catch (e) {} }, 300);
    });
    /* El aviso de guardado se da al salir del campo, para no interrumpir la escritura */
    field.addEventListener("blur", function () { if (store && field.value) say("Borrador guardado en este dispositivo."); });
  });

  if (clear) clear.addEventListener("click", function () {
    var any = fields.some(function (f) { return f.value; });
    if (!any) { say("No hay respuestas que borrar."); return; }
    if (!window.confirm("¿Borrar todas tus respuestas de este capítulo? No se puede deshacer.")) return;
    fields.forEach(function (f) { f.value = ""; count(f); if (store) { try { store.removeItem(KEY + f.dataset.wb); } catch (e) {} } });
    say("Respuestas borradas.");
    fields[0].focus();
  });
})();
