// SmartCustoms NI - generacion del xml y recibo (nueva y buscar)

// secciones del xml: que campos del formulario van en cada una
var SECCIONES_XML = {
    Datos: ['Referencia DUA', 'Manifiesto', 'Tipo Declaración', 'Procedimiento General', 'Aduana de Despacho', 'Total Formularios'],
    Operadores: ['Código Consignatario', 'Código Declarante', 'Cliente / Importador'],
    Paises: ['Primer Destino', 'País Comercial', 'País Exportación', 'País Destino', 'País Origen', 'Nombre País Origen'],
    Transporte: ['Identidad Transporte', 'Nacionalidad Transporte', 'Transporte Frontera', 'Nacionalidad Frontera', 'Modo Transporte',
        'Modo Transporte Interno', 'Incoterm', 'Lugar Entrega', 'Aduana Frontera', 'Lugar Carga', 'Ubicación Mercancía', 'Contenedor'],
    Financiero: ['Código Financiero 1', 'Código Financiero 2', 'Banco', 'Forma de Pago', 'Monto Garantía'],
    Valores: ['Valor Factura', 'Flete Internacional', 'Flete Nacional', 'Seguro', 'Otros Gastos', 'Deducciones', 'Peso Bruto Total', 'Total CIF']
};

// una linea xml: <Nombre>valor</Nombre>, o <Nombre/> si esta vacio
function lineaXML(nombre, valor, sangria) {
    valor = (valor === undefined || valor === null) ? '' : String(valor);
    if (valor == '') return sangria + '<' + nombre + '/>\n';
    return sangria + '<' + nombre + '>' + escaparXML(valor) + '</' + nombre + '>\n';
}

// fecha y hora como 2026-11-01T10:30:00
function fechaHoraISO() {
    var d = new Date();
    function dos(n) { return ('0' + n).slice(-2); }
    return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()) + 'T' +
        dos(d.getHours()) + ':' + dos(d.getMinutes()) + ':' + dos(d.getSeconds());
}

// arma el texto del xml con los datos del registro, ordenado por secciones
function construirXML(registro, tipo) {
    var campos = registro.campos || {};
    var ses = sesionActual();
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<!-- Generado por SmartCustoms NI -->\n';
    xml += '<SmartCustoms version="1.0">\n';

    // cabecera
    xml += '  <Cabecera>\n';
    xml += lineaXML('TipoDocumento', tipo, '    ');
    xml += lineaXML('Referencia', campos['Referencia DUA'], '    ');
    xml += lineaXML('FechaGeneracion', fechaHoraISO(), '    ');
    xml += lineaXML('GeneradoPor', ses ? ses.usuario : '', '    ');
    xml += '  </Cabecera>\n';

    // secciones del formulario
    xml += '  <Declaracion>\n';
    for (var seccion in SECCIONES_XML) {
        xml += '    <' + seccion + '>\n';
        var lista = SECCIONES_XML[seccion];
        for (var i = 0; i < lista.length; i++) {
            xml += lineaXML(limpiarTexto(lista[i]), campos[lista[i]], '      ');
        }
        xml += '    </' + seccion + '>\n';
    }
    xml += '  </Declaracion>\n';

    // documentos (solo los que tienen referencia)
    xml += '  <Documentos>\n';
    var docs = registro.documentos || [];
    for (var d = 0; d < docs.length; d++) {
        if (limpiarEspacios(docs[d].referencia) == '') continue;
        xml += '    <Documento codigo="' + escaparXML(docs[d].codigo) + '">\n';
        xml += lineaXML('Nombre', docs[d].documento, '      ');
        xml += lineaXML('Referencia', docs[d].referencia, '      ');
        xml += lineaXML('Fecha', docs[d].fecha, '      ');
        xml += '    </Documento>\n';
    }
    xml += '  </Documentos>\n';

    // mercancias y sus totales
    var merc = (registro.mercancias || []).filter(function (m) {
        return limpiarEspacios(m.partida + m.descripcion) != '';
    });
    var tot = { fob: 0, bruto: 0, neto: 0, cantidad: 0 };
    xml += '  <Mercancias total="' + merc.length + '">\n';
    for (var j = 0; j < merc.length; j++) {
        var m = merc[j];
        tot.fob += Number(m.fob) || 0;
        tot.bruto += Number(m.pesoBruto) || 0;
        tot.neto += Number(m.pesoNeto) || 0;
        tot.cantidad += Number(m.cantidad) || 0;

        xml += '    <Mercancia numero="' + (j + 1) + '">\n';
        xml += lineaXML('Partida', m.partida, '      ');
        xml += lineaXML('Descripcion', m.descripcion, '      ');
        xml += lineaXML('Cantidad', m.cantidad, '      ');
        xml += lineaXML('PesoBruto', m.pesoBruto, '      ');
        xml += lineaXML('PesoNeto', m.pesoNeto, '      ');
        xml += lineaXML('FOB', m.fob, '      ');
        xml += lineaXML('Origen', m.origen, '      ');
        xml += lineaXML('Procedimiento', m.procedimiento, '      ');
        xml += '    </Mercancia>\n';
    }
    xml += '  </Mercancias>\n';

    xml += '  <Totales>\n';
    xml += lineaXML('Mercancias', merc.length, '    ');
    xml += lineaXML('Cantidad', tot.cantidad.toFixed(2), '    ');
    xml += lineaXML('PesoBruto', tot.bruto.toFixed(2), '    ');
    xml += lineaXML('PesoNeto', tot.neto.toFixed(2), '    ');
    xml += lineaXML('FOB', tot.fob.toFixed(2), '    ');
    xml += '  </Totales>\n';
    xml += '</SmartCustoms>\n';
    return xml;
}

// colorea el xml para la vista previa (tags, atributos, valores, comentarios)
function resaltarXML(xml) {
    var h = escaparXML(xml);
    h = h.replace(/(&lt;\?xml[\s\S]*?\?&gt;)/g, '<span class="x-com">$1</span>');
    h = h.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="x-com">$1</span>');
    h = h.replace(/(&lt;\/?)([A-Za-z_][\w:-]*)/g, '$1<span class="x-tag">$2</span>');
    h = h.replace(/(\s)([A-Za-z_][\w:-]*)=(&quot;[^&]*?&quot;)/g, '$1<span class="x-att">$2</span>=<span class="x-val">$3</span>');
    h = h.replace(/(&gt;)([^&<\n]+)(&lt;\/)/g, '$1<span class="x-txt">$2</span>$3');
    return h;
}

// nombre de archivo seguro: sin espacios ni simbolos raros
function nombreArchivo(tipo, referencia) {
    var ref = String(referencia || 'sin_referencia').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 30);
    return tipo + '_' + ref + '.xml';
}

// copia al portapapeles (si el navegador no deja, usa el metodo viejo)
function copiarTexto(texto) {
    function viejo() {
        var t = document.createElement('textarea');
        t.value = texto;
        t.style.position = 'fixed';
        t.style.opacity = '0';
        document.body.appendChild(t);
        t.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(t);
        mostrarAviso(ok ? 'XML copiado' : 'No se pudo copiar');
    }
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(texto).then(function () { mostrarAviso('XML copiado'); }, viejo);
    } else {
        viejo();
    }
}

// recibo del xml: resumen, vista previa y botones para descargar, copiar o imprimir
function mostrarRecibo(registro, tipo) {
    var xml = construirXML(registro, tipo);
    var campos = registro.campos || {};
    var nombre = nombreArchivo(tipo, campos['Referencia DUA']);
    var cantidad = (registro.mercancias || []).filter(function (m) { return limpiarEspacios(m.partida) != ''; }).length;
    var ahora = fechaHoy() + ' ' + fechaHoraISO().slice(11, 16);

    function dato(titulo, valor) {
        return '<div><small>' + titulo + '</small><b>' + escaparXML(valor || '-') + '</b></div>';
    }

    var html = '<div class="modal modal-ancho recibo">' +
        '<div class="recibo-cab">' +
            '<img class="recibo-logo" src="img/logo-recortado.png" alt="SmartCustoms NI">' +
            '<div class="recibo-titulo"><h2>Recibo de generación XML</h2><span class="recibo-sello">' + escaparXML(tipo) + '</span></div>' +
        '</div>' +
        '<div class="recibo-datos">' +
            dato('Referencia DUA', campos['Referencia DUA']) +
            dato('Cliente / Importador', campos['Cliente / Importador']) +
            dato('Aduana de despacho', campos['Aduana de Despacho']) +
            dato('Mercancías', String(cantidad)) +
            dato('Total CIF', campos['Total CIF']) +
            dato('Generado por', sesionActual().usuario) +
            dato('Fecha y hora', ahora) +
            dato('Archivo', nombre + ' (' + xml.length + ' bytes)') +
        '</div>' +
        '<h3 class="recibo-sub">Vista previa del XML</h3>' +
        '<pre class="xml-codigo">' + resaltarXML(xml) + '</pre>' +
        '<div class="botones recibo-botones">' +
            '<button id="rcDescargar">' + icono('download') + 'Descargar XML</button>' +
            '<button id="rcCopiar" class="agregar">' + icono('list') + 'Copiar</button>' +
            '<button id="rcImprimir" class="agregar">' + icono('printer') + 'Imprimir</button>' +
            '<button id="rcCerrar" class="volver">Cerrar</button>' +
        '</div></div>';

    abrirModal(html);

    $('rcDescargar').onclick = function () {
        descargar(nombre, xml);
        sumarXML();
        mostrarAviso('Se descargó ' + nombre);
    };
    $('rcCopiar').onclick = function () { copiarTexto(xml); };
    $('rcCerrar').onclick = cerrarModal;
    $('rcImprimir').onclick = function () {
        // se marca el body para que el css de impresion solo muestre el recibo
        document.body.classList.add('imprimiendo-recibo');
        window.onafterprint = function () { document.body.classList.remove('imprimiendo-recibo'); };
        window.print();
    };
}

// valida, arma el registro y muestra el recibo
function generarXML(tipo) {
    if (!validar('xml')) return;
    mostrarRecibo(armarRegistro(), tipo);
}
