// SmartCustoms NI - reportes

var FILTROS_REPORTE = ['rDesde', 'rHasta', 'rCliente', 'rAduana', 'rEstado'];
var filasReporte = [];   // declaraciones que pasan los filtros

// total CIF de una declaracion como numero
function cifDe(reg) {
    return parseFloat(reg.campos['Total CIF']) || 0;
}

// de dd/mm/yyyy a yyyy-mm
function mesDe(fecha) {
    return convertirFecha(fecha).slice(0, 7);
}

// formatea con comas y 2 decimales
function dinero(n) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// devuelve solo las declaraciones que cumplen los filtros
function filtrarReporte() {
    var desde = $('rDesde').value;
    var hasta = $('rHasta').value;
    var cliente = $('rCliente').value.toLowerCase();
    var aduana = $('rAduana').value.toLowerCase();
    var estado = $('rEstado').value;

    return leerDeclaraciones().filter(function (r) {
        var fecha = convertirFecha(r.fecha);
        return !(desde && fecha < desde) && !(hasta && fecha > hasta) &&
            (r.cliente || '').toLowerCase().indexOf(cliente) != -1 &&
            (r.aduana || '').toLowerCase().indexOf(aduana) != -1 &&
            (!estado || r.estado == estado);
    });
}

// dice en que grupo cae una declaracion segun el agrupar por
function claveGrupo(reg, tipo) {
    if (tipo == 'mes') return mesDe(reg.fecha);
    if (tipo == 'cliente') return reg.cliente || '(sin cliente)';
    if (tipo == 'aduana') return reg.aduana || '(sin aduana)';
    return reg.estado;
}

// calcula totales y llena las tarjetas y las dos tablas
function dibujarReporte() {
    filasReporte = filtrarReporte();
    var tipo = $('rAgrupar').value;
    var nombres = { mes: 'Mes', cliente: 'Cliente', aduana: 'Aduana', estado: 'Estado' };

    var totalCIF = 0, aprobadas = 0, pendientes = 0;
    var grupos = {};

    for (var i = 0; i < filasReporte.length; i++) {
        var r = filasReporte[i];
        totalCIF += cifDe(r);
        if (r.estado == 'Aprobado') aprobadas++;
        if (r.estado == 'Pendiente') pendientes++;

        var g = claveGrupo(r, tipo);
        if (!grupos[g]) grupos[g] = { cantidad: 0, cif: 0 };
        grupos[g].cantidad++;
        grupos[g].cif += cifDe(r);
    }

    $('rTotal').textContent = filasReporte.length;
    $('rCIF').textContent = dinero(totalCIF);
    $('rAprobadas').textContent = aprobadas;
    $('rPendientes').textContent = pendientes;
    $('thGrupo').textContent = nombres[tipo];
    $('tituloAgrupado').textContent = 'Resumen por ' + nombres[tipo].toLowerCase();

    // resumen
    var nombresGrupo = Object.keys(grupos).sort();
    var html = '';
    for (var j = 0; j < nombresGrupo.length; j++) {
        var n = nombresGrupo[j];
        html += '<tr><td>' + escaparXML(n) + '</td><td>' + grupos[n].cantidad + '</td><td>' + dinero(grupos[n].cif) + '</td></tr>';
    }
    if (html == '') html = '<tr><td colspan="3" class="sin-datos">No hay datos con esos filtros.</td></tr>';
    $('resumen').innerHTML = html;

    // detalle
    html = '';
    for (var k = 0; k < filasReporte.length; k++) {
        var d = filasReporte[k];
        html += '<tr><td>' + escaparXML(d.referencia) + '</td><td>' + escaparXML(d.cliente) + '</td><td>' +
            escaparXML(d.aduana) + '</td><td>' + escaparXML(d.fecha) + '</td><td>' + escaparXML(d.estado) +
            '</td><td>' + escaparXML(d.usuario || '-') + '</td><td>' + dinero(cifDe(d)) + '</td></tr>';
    }
    if (html == '') html = '<tr><td colspan="7" class="sin-datos">No hay datos con esos filtros.</td></tr>';
    $('detalle').innerHTML = html;

    etiquetarTablas();
}

// pone comillas y escapa las comillas dobles
function celdaCSV(t) {
    return '"' + String(t).replace(/"/g, '""') + '"';
}

// CSV con BOM para que Excel respete las tildes
function exportarCSV() {
    if (filasReporte.length == 0) {
        mostrarAviso('No hay datos para exportar');
        return;
    }
    var lineas = [['Referencia', 'Cliente', 'Aduana', 'Fecha', 'Estado', 'Registrada por', 'CIF'].join(',')];
    for (var i = 0; i < filasReporte.length; i++) {
        var r = filasReporte[i];
        lineas.push([r.referencia, r.cliente, r.aduana, r.fecha, r.estado, r.usuario || '', cifDe(r)].map(celdaCSV).join(','));
    }
    descargar('reporte_declaraciones.csv', '\ufeff' + lineas.join('\r\n'), 'text/csv;charset=utf-8');
}

// vacia los filtros y vuelve a dibujar
function limpiarFiltrosReporte() {
    vaciarCampos(FILTROS_REPORTE);
    dibujarReporte();
}

document.addEventListener('DOMContentLoaded', function () {
    if (window.sinAcceso) return;

    alEscribir(FILTROS_REPORTE.concat('rAgrupar'), dibujarReporte);
    $('btnLimpiarReporte').onclick = limpiarFiltrosReporte;
    $('btnCSV').onclick = exportarCSV;
    $('btnPDF').onclick = function () { window.print(); };
    dibujarReporte();
});
