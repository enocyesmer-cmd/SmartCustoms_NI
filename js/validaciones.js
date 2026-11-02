// SmartCustoms NI - validaciones
// Reglas que se repiten en varias paginas. Cada formulario las usa antes de guardar.

// formatos permitidos
var PATRON = {
    codigo: /^[A-Za-z0-9._-]{1,15}$/,        // codigos de cliente, declarante
    referencia: /^[A-Za-z0-9 _-]{1,20}$/,    // referencia DUA, manifiesto
    partida: /^[0-9]{8}$/,                   // partida arancelaria
    pais: /^[A-Za-z]{2}$/,                   // US, NI, CN...
    aduana: /^[0-9]{4}$/,                    // 0610
    procedimiento: /^[0-9]{1,4}$/,           // 4000
    usuario: /^[A-Za-z0-9._-]{3,20}$/,
    ruc: /^[A-Za-z0-9-]{3,20}$/,
    telefono: /^[0-9+() -]{6,20}$/,
    correo: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
};

// quita espacios de mas y caracteres de control (saltos raros, etc)
function limpiarEspacios(texto) {
    return String(texto == null ? '' : texto)
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// true si el texto tiene entre min y max caracteres
function largoOk(texto, min, max) {
    return texto.length >= min && texto.length <= max;
}

// numero valido y no negativo (acepta vacio solo si vacioOk)
function numeroValido(texto, vacioOk) {
    if (texto === '' || texto === null) return !!vacioOk;
    var n = Number(texto);
    return isFinite(n) && n >= 0 && n < 1e12;
}

// la fecha del input date (yyyy-mm-dd) no puede ser futura ni absurda
function fechaValida(texto) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
    var f = new Date(texto + 'T00:00:00');
    if (isNaN(f.getTime())) return false;
    var hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    return f <= hoy && f.getFullYear() >= 2000;
}

// pone limites a los inputs de una pagina para que no peguen textos enormes
function limitarCampos(contenedor, maximoTexto) {
    var inputs = (contenedor || document).querySelectorAll('input, textarea');
    for (var i = 0; i < inputs.length; i++) {
        var t = inputs[i].type;
        if ((t == 'text' || t == 'email' || t == 'tel' || t == 'password') && !inputs[i].hasAttribute('maxlength')) {
            inputs[i].setAttribute('maxlength', maximoTexto || 80);
        }
        if (t == 'number') {
            inputs[i].setAttribute('min', '0');
            inputs[i].setAttribute('step', 'any');
        }
    }
}

// al escribir en un campo marcado en rojo, se le quita la marca
function quitarMarcaAlEscribir() {
    document.addEventListener('input', function (e) {
        if (e.target.classList) e.target.classList.remove('error');
    });
}

// ventana con la lista de problemas encontrados
function mostrarErrores(titulo, lista) {
    var html = '<div class="modal"><h2>' + escaparXML(titulo) + '</h2><ul class="lista-errores">';
    for (var i = 0; i < lista.length && i < 12; i++) {
        html += '<li>' + escaparXML(lista[i]) + '</li>';
    }
    if (lista.length > 12) html += '<li>... y ' + (lista.length - 12) + ' más</li>';
    html += '</ul><div class="botones"><button onclick="cerrarModal()">Entendido</button></div></div>';
    abrirModal(html);
}
