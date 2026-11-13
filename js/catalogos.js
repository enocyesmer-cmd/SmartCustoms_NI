// SmartCustoms NI - clientes y productos
// Une catalogo.js, clientes.js y productos.js. La logica es la misma para los dos (CRUD generico);
// lo unico que cambia entre paginas es su configuracion dentro de CATALOGOS.

// ============================================================
// CONFIGURACION de cada pagina (antes clientes.js y productos.js)
// ============================================================

var CATALOGOS = {
    // clientes (importadores y consignatarios)
    clientes: {
        nombre: 'cliente', plural: 'clientes', clave: K.clientes, guardado: 'Cliente guardado',
        form: 'formCliente', error: 'errorCliente', titulo: 'tituloFormCliente',
        guardar: 'btnGuardarCliente', limpiar: 'btnLimpiarCliente', buscar: 'cBuscar', cuerpo: 'listaClientes',
        maximo: 80,
        columnas: ['codigo', 'nombre', 'tipo', 'ruc', 'telefono', 'correo'],
        buscarEn: ['codigo', 'nombre', 'ruc'],
        duplicado: { prop: 'codigo', mensaje: 'Ya existe un cliente con ese código' },
        campos: [
            { id: 'cCodigo', prop: 'codigo', valida: function (v) { return PATRON.codigo.test(v) ? '' : 'El código es obligatorio: letras, números, punto o guion (máx. 15)'; } },
            { id: 'cNombre', prop: 'nombre', valida: function (v) { return largoOk(v, 2, 80) ? '' : 'El nombre es obligatorio (2 a 80 caracteres)'; } },
            { id: 'cTipo', prop: 'tipo', valida: function (v) { return ['Importador', 'Consignatario', 'Ambos'].indexOf(v) != -1 ? '' : 'Elija un tipo válido'; } },
            { id: 'cRuc', prop: 'ruc', valida: function (v) { return v == '' || PATRON.ruc.test(v) ? '' : 'El RUC solo lleva letras, números y guiones (3 a 20)'; } },
            { id: 'cTelefono', prop: 'telefono', valida: function (v) { return v == '' || PATRON.telefono.test(v) ? '' : 'El teléfono no es válido (solo números, +, guiones y paréntesis)'; } },
            { id: 'cCorreo', prop: 'correo', valida: function (v) { return v == '' || (PATRON.correo.test(v) && v.length <= 80) ? '' : 'El correo no es válido'; } },
            { id: 'cDireccion', prop: 'direccion', max: 120, valida: function (v) { return v.length <= 120 ? '' : 'La dirección es muy larga (máx. 120)'; } }
        ]
    },

    // productos y partidas arancelarias
    productos: {
        nombre: 'producto', plural: 'productos', clave: K.productos, guardado: 'Producto guardado',
        form: 'formProducto', error: 'errorProducto', titulo: 'tituloFormProducto',
        guardar: 'btnGuardarProducto', limpiar: 'btnLimpiarProducto', buscar: 'pBuscar', cuerpo: 'listaProductos',
        maximo: 150,
        columnas: ['partida', 'descripcion', 'origen', 'procedimiento'],
        buscarEn: ['partida', 'descripcion'],
        duplicado: { prop: 'partida', mensaje: 'Esa partida ya está en el catálogo' },
        campos: [
            { id: 'pPartida', prop: 'partida', max: 8, valida: function (v) { return PATRON.partida.test(v) ? '' : 'La partida debe tener exactamente 8 dígitos'; } },
            { id: 'pDescripcion', prop: 'descripcion', valida: function (v) { return largoOk(v, 3, 150) ? '' : 'La descripción es obligatoria (3 a 150 caracteres)'; } },
            { id: 'pOrigen', prop: 'origen', max: 2, mayus: true, valida: function (v) { return v == '' || PATRON.pais.test(v) ? '' : 'El origen debe ser un código de 2 letras, por ejemplo US'; } },
            { id: 'pProc', prop: 'procedimiento', max: 4, def: '4000', valida: function (v) { return v == '' || PATRON.procedimiento.test(v) ? '' : 'El procedimiento solo lleva números (máx. 4 dígitos)'; } }
        ]
    }
};

// la pagina decide cual se usa (data-pagina="clientes" o "productos")
var CATALOGO = CATALOGOS[document.body.getAttribute('data-pagina')];

// ============================================================
// LOGICA comun (antes catalogo.js)
// ============================================================

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
            return '<td>' + escaparHTML(r[p] || '-') + '</td>';
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
    if (window.sinAcceso || !CATALOGO) return;   // esta pagina no es de clientes ni de productos

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
