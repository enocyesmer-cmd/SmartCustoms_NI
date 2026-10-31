

var filasReporte = [];   // declaraciones que pasan los filtros

function cifDe(reg) {
    return parseFloat(reg.campos['Total CIF']) || 0;
}

function mesDe(fecha) {
    // dd/mm/yyyy -> yyyy-mm
    var p = fecha.split('/');
    return p[2] + '-' + p[1];
}

function dinero(n) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function filtrarReporte() {
    var desde = document.getElementById('rDesde').value;
    var hasta = document.getElementById('rHasta').value;
    var cliente = document.getElementById('rCliente').value.toLowerCase();
    var aduana = document.getElementById('rAduana').value.toLowerCase();
    var estado = document.getElementById('rEstado').value;

    var lista = leerDeclaraciones();
    var salida = [];

    for (var i = 0; i < lista.length; i++) {
        var r = lista[i];
        var fecha = convertirFecha(r.fecha);

        if (desde && fecha < desde) continue;
        if (hasta && fecha > hasta) continue;
        if (cliente && (r.cliente || '').toLowerCase().indexOf(cliente) == -1) continue;
        if (aduana && (r.aduana || '').toLowerCase().indexOf(aduana) == -1) continue;
        if (estado && r.estado != estado) continue;
        salida.push(r);
    }
    return salida;
}

function claveGrupo(reg, tipo) {
    if (tipo == 'mes') return mesDe(reg.fecha);
    if (tipo == 'cliente') return reg.cliente || '(sin cliente)';
    if (tipo == 'aduana') return reg.aduana || '(sin aduana)';
    return reg.estado;
}

function dibujarReporte() {
    filasReporte = filtrarReporte();
    var tipo = document.getElementById('rAgrupar').value;
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

    document.getElementById('rTotal').textContent = filasReporte.length;
    document.getElementById('rCIF').textContent = dinero(totalCIF);
    document.getElementById('rAprobadas').textContent = aprobadas;
    document.getElementById('rPendientes').textContent = pendientes;
    document.getElementById('thGrupo').textContent = nombres[tipo];
    document.getElementById('tituloAgrupado').textContent = 'Resumen por ' + nombres[tipo].toLowerCase();

    // resumen
    var nombresGrupo = Object.keys(grupos).sort();
    var html = '';
    for (var j = 0; j < nombresGrupo.length; j++) {
        var n = nombresGrupo[j];
        html += '<tr><td>' + escaparXML(n) + '</td><td>' + grupos[n].cantidad + '</td><td>' + dinero(grupos[n].cif) + '</td></tr>';
    }
    if (html == '') html = '<tr><td colspan="3" class="sin-datos">No hay datos con esos filtros.</td></tr>';
    document.getElementById('resumen').innerHTML = html;

    // detalle
    html = '';
    for (var k = 0; k < filasReporte.length; k++) {
        var d = filasReporte[k];
        html += '<tr><td>' + escaparXML(d.referencia) + '</td><td>' + escaparXML(d.cliente) + '</td><td>' +
            escaparXML(d.aduana) + '</td><td>' + escaparXML(d.fecha) + '</td><td>' + escaparXML(d.estado) +
            '</td><td>' + escaparXML(d.usuario || '-') + '</td><td>' + dinero(cifDe(d)) + '</td></tr>';
    }
    if (html == '') html = '<tr><td colspan="7" class="sin-datos">No hay datos con esos filtros.</td></tr>';
    document.getElementById('detalle').innerHTML = html;

    etiquetarTablas();
}

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
    var blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'reporte_declaraciones.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function limpiarFiltrosReporte() {
    var ids = ['rDesde', 'rHasta', 'rCliente', 'rAduana', 'rEstado'];
    for (var i = 0; i < ids.length; i++) document.getElementById(ids[i]).value = '';
    dibujarReporte();
}

document.addEventListener('DOMContentLoaded', function () {
    if (window.sinAcceso) return;

    var ids = ['rDesde', 'rHasta', 'rCliente', 'rAduana', 'rEstado', 'rAgrupar'];
    for (var i = 0; i < ids.length; i++) {
        document.getElementById(ids[i]).addEventListener('input', dibujarReporte);
    }
    document.getElementById('btnLimpiarReporte').onclick = limpiarFiltrosReporte;
    document.getElementById('btnCSV').onclick = exportarCSV;
    document.getElementById('btnPDF').onclick = function () { window.print(); };
    dibujarReporte();
});
