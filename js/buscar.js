// SmartCustoms NI - pagina de buscar declaraciones

// arma una fila de la tabla de resultados
function crearFila(reg) {
    var tr = document.createElement('tr');
    tr.setAttribute('data-fila', '');
    tr.setAttribute('data-id', reg.id);
    var clase = reg.estado.toLowerCase();

    tr.innerHTML =
        '<td><span class="estado ' + clase + '">' + escaparXML(reg.estado) + '</span></td>' +
        '<td>' + escaparXML(reg.referencia) + '</td>' +
        '<td>' + escaparXML(reg.tipo) + '</td>' +
        '<td>' + escaparXML(reg.factura || '-') + '</td>' +
        '<td>' + escaparXML(reg.cliente) + '</td>' +
        '<td>' + escaparXML(reg.proveedor || '-') + '</td>' +
        '<td>' + escaparXML(reg.aduana) + '</td>' +
        '<td>' + escaparXML(reg.fecha) + '</td>' +
        '<td class="acciones"></td>';
    return tr;
}

// lee los datos de una fila de la tabla
function datosDeFila(tr) {
    var c = tr.cells;
    return {
        estado: c[0].textContent.trim(),
        referencia: c[1].textContent.trim(),
        tipo: c[2].textContent.trim(),
        factura: c[3].textContent.trim(),
        cliente: c[4].textContent.trim(),
        proveedor: c[5].textContent.trim(),
        aduana: c[6].textContent.trim(),
        fecha: c[7].textContent.trim()
    };
}

// muestra el detalle de la fila en una ventana
function verDeclaracion(tr) {
    var d = datosDeFila(tr);
    var filas = [
        ['Estado', d.estado], ['Tipo', d.tipo], ['Factura', d.factura],
        ['Cliente', d.cliente], ['Proveedor', d.proveedor],
        ['Aduana', d.aduana], ['Fecha', d.fecha]
    ];

    var reg = buscarRegistro(tr.getAttribute('data-id'));
    if (reg) {
        filas.push(['Registrada por', reg.usuario]);
        var h = reg.historial || [];
        for (var i = 0; i < h.length; i++) {
            filas.push(['Historial ' + (i + 1), h[i].fecha + ' - ' + h[i].estado + ' (' + h[i].usuario + ')']);
        }
    }
    mostrarVentana('Declaración ' + d.referencia, filas);
}

// muestra el recibo con el xml de una fila (guardada o de ejemplo)
function xmlDeFila(tr) {
    var reg = buscarRegistro(tr.getAttribute('data-id'));

    // las filas de ejemplo no tienen formulario guardado, se arma con lo que hay
    if (!reg) {
        var d = datosDeFila(tr);
        reg = {
            campos: {
                'Referencia DUA': d.referencia, 'Tipo Declaración': d.tipo,
                'Cliente / Importador': d.cliente, 'Aduana de Despacho': d.aduana
            },
            documentos: [{ codigo: '380', documento: 'Factura Comercial', referencia: d.factura, fecha: '' }],
            mercancias: []
        };
    }
    mostrarRecibo(reg, 'DUA');
}

// el declarante solo toca las suyas y mientras esten pendientes; el admin todas
function puedeEditarRegistro(reg) {
    var ses = sesionActual();
    if (ses.rol == 'administrador') return true;
    return ses.rol == 'declarante' && reg.usuario == ses.usuario && reg.estado == 'Pendiente';
}

// pasa al siguiente estado: Pendiente > Revisado > Aprobado > Pendiente
function cambiarEstado(tr) {
    var lista = leerDeclaraciones();
    var reg = porId(lista, tr.getAttribute('data-id'));
    var siguiente = { 'Pendiente': 'Revisado', 'Revisado': 'Aprobado', 'Aprobado': 'Pendiente' };
    if (!reg) return;

    reg.estado = siguiente[reg.estado];
    reg.historial = reg.historial || [];
    reg.historial.push({ usuario: sesionActual().usuario, fecha: fechaHoy(), estado: reg.estado });

    var nueva = crearFila(reg);
    tr.parentNode.replaceChild(nueva, tr);
    ponerAcciones(nueva);
    guardarDeclaraciones(lista);
    decorarEstados();
    etiquetarTablas();
    buscarDeclaraciones();
}

var FILTROS = ['fRef', 'fFactura', 'fCliente', 'fDesde', 'fHasta'];

// icono de cada boton de las filas (segun su clase)
var ICONO_BOTON = { ver: 'eye', editar: 'edit', 'estado-btn': 'check-circle', xml: 'download', borrar: 'trash' };

// icono de cada estado
var ICONO_ESTADO = { pendiente: 'clock', revisado: 'eye', aprobado: 'check-circle' };

// le pone su icono a las etiquetas de estado que todavia no lo tengan
function decorarEstados() {
    var etiquetas = document.querySelectorAll('.estado');
    for (var i = 0; i < etiquetas.length; i++) {
        if (etiquetas[i].querySelector('svg')) continue;
        var clase = etiquetas[i].className.replace('estado', '').trim();
        etiquetas[i].insertAdjacentHTML('afterbegin', icono(ICONO_ESTADO[clase], 'ico-chico'));
    }
}

// pone los botones de cada fila segun el rol de quien entro
function ponerAcciones(tr) {
    var celda = tr.querySelector('.acciones');
    var reg = buscarRegistro(tr.getAttribute('data-id'));
    var ses = sesionActual();
    celda.innerHTML = '';

    function boton(texto, clase, fn) {
        var b = document.createElement('button');
        b.innerHTML = icono(ICONO_BOTON[clase]) + texto;
        b.className = clase;
        b.onclick = fn;
        celda.appendChild(b);
    }

    boton('Ver', 'ver', function () { verDeclaracion(tr); });

    if (reg && puedeEditarRegistro(reg)) {
        boton('Editar', 'editar', function () {
            localStorage.setItem(CLAVE_EDITAR, tr.getAttribute('data-id'));
            window.location.href = 'nueva_declaracion.html';
        });
    }
    if (reg && (ses.rol == 'revisor' || ses.rol == 'administrador')) {
        var textos = { 'Pendiente': 'Revisar', 'Revisado': 'Aprobar', 'Aprobado': 'Reabrir' };
        boton(textos[reg.estado], 'estado-btn', function () { cambiarEstado(tr); });
    }
    boton('XML', 'xml', function () { xmlDeFila(tr); });
    if (reg && puedeEditarRegistro(reg)) {
        boton('Eliminar', 'borrar', function () { eliminarDeclaracion(tr); });
    }
}

// pregunta y borra la declaracion
function eliminarDeclaracion(tr) {
    if (!confirm('¿Eliminar la declaración ' + tr.cells[1].textContent + '?')) return;
    var id = tr.getAttribute('data-id');
    var lista = leerDeclaraciones().filter(function (r) { return r.id != id; });
    guardarDeclaraciones(lista);
    tr.parentNode.removeChild(tr);
    buscarDeclaraciones();
}

// lo que se hace al abrir la pagina de buscar
function iniciarBusqueda() {
    var cuerpo = $('resultados');
    var sinDatos = $('sinDatos');
    var ses = sesionActual();

    // las guardadas se agregan al principio; el declarante solo ve las suyas
    var lista = leerDeclaraciones();
    for (var i = lista.length - 1; i >= 0; i--) {
        if (ses.rol == 'declarante' && lista[i].usuario != ses.usuario) continue;
        cuerpo.insertBefore(crearFila(lista[i]), cuerpo.firstChild);
    }

    var filas = cuerpo.querySelectorAll('tr[data-fila]');
    for (var j = 0; j < filas.length; j++) ponerAcciones(filas[j]);

    // el revisor no crea declaraciones
    if (!puedeVerPagina('nueva', ses.rol)) {
        var btn = document.querySelector('.filtros .nueva');
        if (btn) btn.style.display = 'none';
    }

    // buscar al escribir
    alEscribir(FILTROS, buscarDeclaraciones);
    sinDatos.style.display = 'none';
    decorarEstados();
}

// esconde las filas que no cumplen los filtros
function buscarDeclaraciones() {
    var ref = $('fRef').value.toLowerCase();
    var fac = $('fFactura').value.toLowerCase();
    var cli = $('fCliente').value.toLowerCase();
    var desde = $('fDesde').value;
    var hasta = $('fHasta').value;

    var filas = document.querySelectorAll('#resultados tr[data-fila]');
    var visibles = 0;

    for (var i = 0; i < filas.length; i++) {
        var c = filas[i].cells;
        var fecha = convertirFecha(c[7].textContent.trim());
        var ok = true;

        if (ref && c[1].textContent.toLowerCase().indexOf(ref) == -1) ok = false;
        if (fac && c[3].textContent.toLowerCase().indexOf(fac) == -1) ok = false;
        if (cli && c[4].textContent.toLowerCase().indexOf(cli) == -1) ok = false;
        if (desde && fecha < desde) ok = false;
        if (hasta && fecha > hasta) ok = false;

        filas[i].style.display = ok ? '' : 'none';
        if (ok) visibles++;
    }
    $('sinDatos').style.display = visibles == 0 ? '' : 'none';
}

// vacia los filtros y vuelve a mostrar todo
function limpiarFiltros() {
    vaciarCampos(FILTROS);
    buscarDeclaraciones();
}
