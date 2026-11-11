// SmartCustoms NI - recibo de la declaracion (nueva y buscar)
// Arma un recibo informativo para imprimir o guardar como PDF. No genera archivos.

// secciones del recibo: titulo, icono y campos del formulario que van en cada una.
// vacios: true = si el campo esta vacio se muestra "-"; false = el campo se oculta
var SECCIONES_RECIBO = [
    { titulo: 'Datos de la declaración', ico: 'file-text', vacios: true,
        campos: ['Manifiesto', 'Tipo Declaración', 'Procedimiento General', 'Aduana de Despacho', 'Total Formularios'] },
    { titulo: 'Operadores', ico: 'users', vacios: true,
        campos: ['Cliente / Importador', 'Código Consignatario', 'Código Declarante'] },
    { titulo: 'Países', ico: 'globe', vacios: false,
        campos: ['País Origen', 'Nombre País Origen', 'País Exportación', 'País Comercial', 'Primer Destino', 'País Destino'] },
    { titulo: 'Transporte', ico: 'truck', vacios: false,
        campos: ['Identidad Transporte', 'Nacionalidad Transporte', 'Transporte Frontera', 'Nacionalidad Frontera', 'Modo Transporte',
            'Modo Transporte Interno', 'Incoterm', 'Lugar Entrega', 'Aduana Frontera', 'Lugar Carga', 'Ubicación Mercancía', 'Contenedor'] },
    { titulo: 'Información financiera', ico: 'shield', vacios: false,
        campos: ['Código Financiero 1', 'Código Financiero 2', 'Banco', 'Forma de Pago', 'Monto Garantía'] }
];

// ---------- formatos ----------

// texto a numero (0 si no es numero)
function aNumero(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
}

// numero con comas y 2 decimales: 1,234.50
function formatoNumero(v) {
    return aNumero(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// cantidades: sin decimales de mas (10, 2.5)
function formatoCantidad(v) {
    return aNumero(v).toLocaleString('en-US', { maximumFractionDigits: 3 });
}

function conCero(n) {
    return ('0' + n).slice(-2);
}

// fecha y hora de ahora como dd/mm/yyyy hh:mm
function fechaHoraAhora() {
    var d = new Date();
    return fechaHoy() + ' ' + conCero(d.getHours()) + ':' + conCero(d.getMinutes());
}

// de yyyy-mm-dd (el input date) a dd/mm/yyyy
function fechaDocumento(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return iso || '-';
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
}

// ---------- calculos ----------

// saca del registro lo que lleva el recibo: mercancias, totales, documentos y avisos
function calcularRecibo(registro) {
    var c = registro.campos || {};
    var merc = (registro.mercancias || []).filter(function (m) {
        return limpiarEspacios((m.partida || '') + (m.descripcion || '')) != '';
    });
    var docs = (registro.documentos || []).filter(function (d) {
        return limpiarEspacios(d.referencia) != '';
    });

    var tot = { bruto: 0, neto: 0, fob: 0 };
    merc.forEach(function (m) {
        tot.bruto += aNumero(m.pesoBruto);
        tot.neto += aNumero(m.pesoNeto);
        tot.fob += aNumero(m.fob);
    });

    // avisos: no bloquean el recibo, solo avisan lo que se ve raro
    var avisos = [];
    if (registro.ejemplo) {
        avisos.push('Es una fila de ejemplo: solo tiene referencia, tipo, factura, cliente y aduana.');
    } else {
        var valorFactura = aNumero(c['Valor Factura']);
        var pesoTotal = aNumero(c['Peso Bruto Total']);
        var hayFactura = docs.some(function (d) { return d.codigo == '380'; });

        if (!(valorFactura > 0)) avisos.push('Falta el Valor Factura.');
        if (merc.length == 0) avisos.push('No tiene mercancías.');
        if (!hayFactura) avisos.push('Falta la Factura Comercial (código 380) con su referencia.');
        if (valorFactura > 0 && merc.length > 0 && Math.abs(tot.fob - valorFactura) > 0.01) {
            avisos.push('La suma del FOB de las mercancías (' + formatoNumero(tot.fob) + ') no coincide con el Valor Factura (' + formatoNumero(valorFactura) + ').');
        }
        if (pesoTotal > 0 && tot.bruto > 0 && Math.abs(tot.bruto - pesoTotal) > 0.01) {
            avisos.push('La suma del peso bruto de las mercancías (' + formatoNumero(tot.bruto) + ') no coincide con el Peso Bruto Total (' + formatoNumero(pesoTotal) + ').');
        }
    }
    return { c: c, merc: merc, docs: docs, tot: tot, avisos: avisos };
}

// ---------- piezas del recibo ----------

function reciboDato(titulo, valor) {
    return '<div class="rc-dato"><small>' + escaparHTML(titulo) + '</small><b>' + escaparHTML(valor) + '</b></div>';
}

function reciboSeccion(titulo, ico, cuerpo) {
    return '<section class="rc-seccion"><h3>' + icono(ico) + escaparHTML(titulo) + '</h3>' + cuerpo + '</section>';
}

// una seccion de campos del formulario (se salta si no tiene nada que mostrar)
function reciboCampos(sec, c) {
    var html = '';
    sec.campos.forEach(function (nombre) {
        var v = limpiarEspacios(c[nombre]);
        if (v == '' && !sec.vacios) return;
        if (nombre == 'Monto Garantía' && v != '') v = formatoNumero(v);
        html += reciboDato(nombre, v == '' ? '-' : v);
    });
    return html == '' ? '' : reciboSeccion(sec.titulo, sec.ico, '<div class="rc-grid">' + html + '</div>');
}

// valores aduaneros: suma de arriba hacia abajo hasta el Total CIF
function reciboValores(c) {
    function linea(signo, nombre, valor, clase) {
        var v = limpiarEspacios(valor);
        return '<tr class="' + (clase || '') + '"><td class="rc-signo">' + signo + '</td><td>' + nombre + '</td>' +
            '<td class="num">' + (v == '' ? '-' : formatoNumero(v)) + '</td></tr>';
    }
    var html = '<table class="rc-tabla rc-valores"><tbody>' +
        linea('', 'Valor Factura', c['Valor Factura']) +
        linea('+', 'Flete Internacional', c['Flete Internacional']) +
        linea('+', 'Flete Nacional', c['Flete Nacional']) +
        linea('+', 'Seguro', c['Seguro']) +
        linea('+', 'Otros Gastos', c['Otros Gastos']) +
        linea('−', 'Deducciones', c['Deducciones']) +
        linea('=', 'Total CIF', c['Total CIF'], 'rc-total') +
        linea('', 'Peso Bruto Total', c['Peso Bruto Total'], 'rc-peso') +
        '</tbody></table>';
    return reciboSeccion('Valores aduaneros', 'chart', html);
}

function reciboDocumentos(docs) {
    if (docs.length == 0) return '';
    var filas = docs.map(function (d) {
        return '<tr><td>' + escaparHTML(d.codigo) + '</td><td>' + escaparHTML(d.documento) + '</td>' +
            '<td>' + escaparHTML(d.referencia) + '</td><td>' + escaparHTML(fechaDocumento(d.fecha)) + '</td></tr>';
    }).join('');
    return reciboSeccion('Documentos adjuntos', 'file-text',
        '<div class="rc-scroll"><table class="rc-tabla"><thead><tr><th>Código</th><th>Documento</th><th>Referencia</th><th>Fecha</th></tr></thead>' +
        '<tbody>' + filas + '</tbody></table></div>');
}

function reciboMercancias(merc, tot) {
    var cuerpo = '';
    merc.forEach(function (m, i) {
        cuerpo += '<tr><td>' + (i + 1) + '</td><td>' + escaparHTML(m.partida || '-') + '</td><td class="rc-desc">' + escaparHTML(m.descripcion || '-') + '</td>' +
            '<td class="num">' + formatoCantidad(m.cantidad) + '</td><td class="num">' + formatoNumero(m.pesoBruto) + '</td>' +
            '<td class="num">' + formatoNumero(m.pesoNeto) + '</td><td class="num">' + formatoNumero(m.fob) + '</td>' +
            '<td>' + escaparHTML(m.origen || '-') + '</td><td>' + escaparHTML(m.procedimiento || '-') + '</td></tr>';
    });
    if (cuerpo == '') cuerpo = '<tr><td colspan="9" class="rc-vacio">Sin mercancías registradas.</td></tr>';

    var pie = merc.length == 0 ? '' :
        '<tfoot><tr class="rc-total"><td colspan="4">Totales (' + merc.length + (merc.length == 1 ? ' mercancía)' : ' mercancías)') + '</td>' +
        '<td class="num">' + formatoNumero(tot.bruto) + '</td><td class="num">' + formatoNumero(tot.neto) + '</td>' +
        '<td class="num">' + formatoNumero(tot.fob) + '</td><td colspan="2"></td></tr></tfoot>';

    return reciboSeccion('Mercancías', 'package',
        '<div class="rc-scroll"><table class="rc-tabla"><thead><tr><th>#</th><th>Partida</th><th>Descripción</th><th class="num">Cant.</th>' +
        '<th class="num">P. Bruto</th><th class="num">P. Neto</th><th class="num">FOB</th><th>Origen</th><th>Proc.</th></tr></thead>' +
        '<tbody>' + cuerpo + '</tbody>' + pie + '</table></div>');
}

// ---------- el recibo ----------

// opciones: { formato: 'DAV' | 'DUA' (solo desde el formulario), origen: 'formulario' | 'guardada' }
function mostrarRecibo(registro, opciones) {
    opciones = opciones || {};
    var r = calcularRecibo(registro);
    var c = r.c;
    var ses = sesionActual();
    var empresa = limpiarEspacios(leerConfig().empresa);
    var referencia = limpiarEspacios(c['Referencia DUA']);
    var tipo = c['Tipo Declaración'] == 'EXP' ? 'Exportación' : (c['Tipo Declaración'] == 'IMP' ? 'Importación' : '');

    // el estado solo existe si la declaracion ya esta guardada
    var estado = '';
    if (opciones.origen == 'guardada' && registro.estado) {
        estado = '<span class="estado ' + escaparHTML(String(registro.estado).toLowerCase()) + '">' + escaparHTML(registro.estado) + '</span>';
    }

    var html = '<div class="modal modal-ancho recibo"><div class="rc-hoja">' +
        '<header class="rc-cab">' +
            '<img class="rc-logo" src="img/logo-recortado.png" alt="SmartCustoms NI">' +
            '<div class="rc-titulo">' +
                '<h2>Recibo de declaración</h2>' +
                '<p>Declaración aduanera' + (tipo ? ' · ' + tipo : '') + '</p>' +
                (opciones.formato ? '<span class="rc-sello">' + escaparHTML(opciones.formato) + '</span>' : '') +
            '</div>' +
        '</header>' +

        '<div class="rc-resumen">' +
            '<div class="rc-ref"><small>Referencia DUA</small><strong>' + escaparHTML(referencia || '-') + '</strong>' + estado + '</div>' +
            '<div class="rc-meta">' +
                reciboDato('Fecha de la declaración', registro.fecha || fechaHoy()) +
                reciboDato('Emitido', fechaHoraAhora()) +
                reciboDato('Generado por', ses ? ses.usuario : '-') +
                (empresa ? reciboDato('Declarante', empresa) : '') +
            '</div>' +
        '</div>';

    if (r.avisos.length) {
        html += '<div class="rc-avisos no-imprimir"><b>Revise antes de imprimir</b><ul>' +
            r.avisos.map(function (a) { return '<li>' + escaparHTML(a) + '</li>'; }).join('') + '</ul></div>';
    }

    SECCIONES_RECIBO.forEach(function (sec) { html += reciboCampos(sec, c); });
    if (!registro.ejemplo) html += reciboValores(c);
    html += reciboDocumentos(r.docs);
    if (!registro.ejemplo) html += reciboMercancias(r.merc, r.tot);

    html += '<div class="rc-firmas"><div><span></span>Firma del declarante</div><div><span></span>Recibido por</div></div>' +
        '<p class="rc-pie">Documento informativo generado por SmartCustoms NI. No es una declaración oficial ni sustituye el trámite en SIDUNEA World.</p>' +
        '</div>' +
        '<div class="botones recibo-botones">' +
            '<button id="rcImprimir">' + icono('printer') + 'Imprimir / Guardar PDF</button>' +
            '<button id="rcCerrar" class="volver">Cerrar</button>' +
        '</div></div>';

    abrirModal(html);
    if (!registro.ejemplo) sumarRecibo();

    $('rcCerrar').onclick = cerrarModal;
    $('rcImprimir').onclick = function () {
        // se marca el body para que el css de impresion solo muestre el recibo,
        // y se cambia el titulo para que el PDF se llame Recibo_DUA_209754
        var tituloAntes = document.title;
        var nombre = 'Recibo_' + (opciones.formato ? opciones.formato + '_' : '') +
            (referencia.replace(/[^A-Za-z0-9_-]+/g, '_') || 'sin_referencia');
        document.title = nombre;
        document.body.classList.add('imprimiendo-recibo');
        window.onafterprint = function () {
            document.body.classList.remove('imprimiendo-recibo');
            document.title = tituloAntes;
            window.onafterprint = null;
        };
        window.print();
    };
}

// valida el formulario completo y muestra el recibo
function generarRecibo(formato) {
    if (!validar('recibo')) return;
    mostrarRecibo(armarRegistro(), { formato: formato, origen: 'formulario' });
}
