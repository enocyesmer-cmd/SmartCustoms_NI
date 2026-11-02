// SmartCustoms NI - CRUD generico para clientes y productos
// Cada pagina define su configuracion en CATALOGO (clientes.js / productos.js)

var editando = null;   // id del registro que se esta editando

// valor limpio de un campo del formulario
function valorCampo(id) {
    return limpiarEspacios($(id).value);
}

// deja el formulario vacio y sale del modo editar
function limpiarForm() {
    CATALOGO.campos.forEach(function (c) {
        var el = $(c.id);
        if (el.tagName == 'SELECT') el.selectedIndex = 0;
        else el.value = c.def || '';
    });
    $(CATALOGO.error).textContent = '';
    $(CATALOGO.titulo).textContent = 'Nuevo ' + CATALOGO.nombre;
    editando = null;
}

// valida campo por campo (se queda con el primer error) y guarda
function guardarRegistro() {
    var lista = leerLista(CATALOGO.clave);
    var reg = { id: editando || nuevoId() };
    var malo = null;

    CATALOGO.campos.forEach(function (c) {
        var v = valorCampo(c.id);
        reg[c.prop] = c.mayus ? v.toUpperCase() : v;
        var msg = c.valida(reg[c.prop]);
        if (msg && !malo) malo = { id: c.id, msg: msg };
    });

    document.querySelectorAll('#' + CATALOGO.form + ' .error').forEach(function (e) { e.classList.remove('error'); });
    if (malo) {
        $(malo.id).classList.add('error');
        $(malo.id).focus();
        $(CATALOGO.error).textContent = malo.msg;
        return;
    }

    var dup = CATALOGO.duplicado;
    var repetido = lista.some(function (x) {
        return String(x[dup.prop]).toLowerCase() == String(reg[dup.prop]).toLowerCase() && x.id != reg.id;
    });
    if (repetido) { $(CATALOGO.error).textContent = dup.mensaje; return; }

    if (editando) lista = lista.map(function (x) { return x.id == editando ? reg : x; });
    else lista.push(reg);

    if (!guardarLista(CATALOGO.clave, lista)) return;
    limpiarForm();
    mostrarLista();
    mostrarAviso(CATALOGO.guardado);
}

// dibuja la tabla aplicando el buscador
function mostrarLista() {
    var texto = valorCampo(CATALOGO.buscar).toLowerCase();
    var puedeModificar = puedeModificarCatalogos(sesionActual().rol);
    var html = '';

    leerLista(CATALOGO.clave).forEach(function (r) {
        var junto = CATALOGO.buscarEn.map(function (p) { return r[p]; }).join(' ').toLowerCase();
        if (texto && junto.indexOf(texto) == -1) return;

        html += '<tr>' + CATALOGO.columnas.map(function (p) {
            return '<td>' + escaparXML(r[p] || '-') + '</td>';
        }).join('') + '<td class="acciones">';
        if (puedeModificar) {
            html += '<button class="editar" data-id="' + r.id + '">' + icono('edit') + 'Editar</button>' +
                '<button class="borrar" data-id="' + r.id + '">' + icono('trash') + 'Eliminar</button>';
        }
        html += '</td></tr>';
    });

    $(CATALOGO.cuerpo).innerHTML = html ||
        '<tr><td colspan="' + (CATALOGO.columnas.length + 1) + '" class="sin-datos">No hay ' + CATALOGO.plural + ' para mostrar.</td></tr>';
    etiquetarTablas();
}

// botones Editar / Eliminar de la tabla (un solo evento para todas las filas)
function accionFila(e) {
    var b = e.target.closest('button[data-id]');
    if (!b) return;
    var lista = leerLista(CATALOGO.clave);

    if (b.className == 'editar') {
        var r = porId(lista, b.dataset.id);
        if (!r) return;
        CATALOGO.campos.forEach(function (c) { $(c.id).value = r[c.prop]; });
        editando = r.id;
        $(CATALOGO.titulo).textContent = 'Editar ' + CATALOGO.nombre;
        window.scrollTo(0, 0);
    } else if (confirm('¿Eliminar este ' + CATALOGO.nombre + '?')) {
        guardarLista(CATALOGO.clave, lista.filter(function (x) { return x.id != b.dataset.id; }));
        mostrarLista();
    }
}

document.addEventListener('DOMContentLoaded', function () {
    if (window.sinAcceso) return;

    // el revisor solo consulta
    if (!puedeModificarCatalogos(sesionActual().rol)) $(CATALOGO.form).style.display = 'none';

    limitarCampos($(CATALOGO.form), CATALOGO.maximo);
    CATALOGO.campos.forEach(function (c) { if (c.max) $(c.id).setAttribute('maxlength', c.max); });
    quitarMarcaAlEscribir();

    $(CATALOGO.guardar).onclick = guardarRegistro;
    $(CATALOGO.limpiar).onclick = limpiarForm;
    $(CATALOGO.buscar).addEventListener('input', mostrarLista);
    $(CATALOGO.cuerpo).addEventListener('click', accionFila);
    mostrarLista();
});
