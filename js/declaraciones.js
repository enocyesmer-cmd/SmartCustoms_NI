// SmartCustoms NI - declaraciones
// Une recibo.js, nueva.js y buscar.js (las paginas Nueva Declaracion y Buscar Declaracion).

// ============================================================
// 1. RECIBO - recibo para imprimir o guardar en PDF (antes recibo.js)
// ============================================================

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

// ============================================================
// 2. NUEVA DECLARACION - formulario (antes nueva.js)
// ============================================================

var MAX_MERCANCIAS = 50;                   // tope de filas en la tabla de mercancias
var editandoId = null;                     // id de la declaracion que se esta editando

// lee un input y lo devuelve como numero (0 si esta vacio)
function numero(id) {
    var campo = $(id);
    if (!campo) return 0;
    return parseFloat(campo.value) || 0;
}

// Total CIF = factura + fletes + seguro + otros gastos - deducciones
function calcularCIF() {
    var total = numero('valorFactura') + numero('fleteInternacional') +
        numero('fleteNacional') + numero('seguro') +
        numero('otrosGastos') - numero('deducciones');
    $('totalCIF').value = total.toFixed(2);
}

// celda con el boton Quitar de cada mercancia
function filaQuitar() {
    // celda con el boton para quitar una mercancia
    var td = document.createElement('td');
    td.setAttribute('data-label', 'Acción');
    td.innerHTML = '<button class="quitar" type="button">' + icono('trash') + 'Quitar</button>';
    td.firstChild.onclick = function () {
        quitarMercancia(this.parentNode.parentNode);
    };
    return td;
}

// agrega la columna Accion a la tabla de mercancias
function prepararMercancias() {
    var cuerpo = $('cuerpoMercancias');
    var encabezado = cuerpo.parentNode.querySelector('thead tr');
    var th = document.createElement('th');
    th.textContent = 'Acción';
    encabezado.appendChild(th);

    for (var i = 0; i < cuerpo.rows.length; i++) {
        cuerpo.rows[i].appendChild(filaQuitar());
    }
}

// copia la primera fila, la deja vacia y la agrega al final
function agregarMercancia() {
    var cuerpo = $('cuerpoMercancias');
    if (cuerpo.rows.length >= MAX_MERCANCIAS) {
        mostrarAviso('Máximo ' + MAX_MERCANCIAS + ' mercancías por declaración');
        return;
    }
    var fila = cuerpo.rows[0].cloneNode(true);
    var campos = fila.querySelectorAll('input');

    for (var i = 0; i < campos.length; i++) {
        campos[i].value = '';
        campos[i].removeAttribute('placeholder');
    }
    // el clon trae su boton sin evento, se cambia por uno nuevo
    fila.removeChild(fila.lastChild);
    fila.appendChild(filaQuitar());
    fila.classList.add('fila-nueva');   // para la animacion de entrada
    cuerpo.appendChild(fila);
}

// borra la fila pero siempre deja al menos una
function quitarMercancia(fila) {
    var cuerpo = $('cuerpoMercancias');
    if (cuerpo.rows.length == 1) {
        mostrarAviso('Debe quedar al menos una mercancía');
        return;
    }
    cuerpo.removeChild(fila);
}

// recorre los campos de las secciones y devuelve {etiqueta: valor}
function leerCampos() {
    var datos = {};
    var tarjetas = document.querySelectorAll('.form-card');

    for (var t = 0; t < tarjetas.length; t++) {
        var bloques = tarjetas[t].querySelectorAll('.grid > div');
        for (var b = 0; b < bloques.length; b++) {
            if (bloques[b].hasAttribute('data-ignorar')) continue;
            var etiqueta = bloques[b].querySelector('label');
            var campo = bloques[b].querySelector('input, select');
            if (etiqueta && campo) datos[etiqueta.textContent.trim()] = campo.value;
        }
    }
    return datos;
}

// lee la tabla de documentos adjuntos
function leerDocumentos() {
    var lista = [];
    var tabla = document.querySelectorAll('.form-card table')[0];
    for (var i = 0; i < tabla.rows.length; i++) {
        var td = tabla.rows[i].querySelectorAll('td');
        if (td.length == 0) continue;
        lista.push({
            codigo: td[0].textContent,
            documento: td[1].textContent,
            referencia: td[2].querySelector('input').value,
            fecha: td[3].querySelector('input').value
        });
    }
    return lista;
}

// lee todas las filas de la tabla de mercancias
function leerMercancias() {
    var lista = [];
    var cuerpo = $('cuerpoMercancias');
    var nombres = ['partida', 'descripcion', 'cantidad', 'pesoBruto', 'pesoNeto', 'fob', 'origen', 'procedimiento'];

    for (var i = 0; i < cuerpo.rows.length; i++) {
        var inputs = cuerpo.rows[i].querySelectorAll('input');
        var m = {};
        for (var j = 0; j < nombres.length; j++) m[nombres[j]] = inputs[j].value;
        lista.push(m);
    }
    return lista;
}

// junta todo el formulario en un solo objeto para guardarlo
function armarRegistro() {
    var campos = leerCampos();
    var docs = leerDocumentos();
    var factura = '';
    for (var i = 0; i < docs.length; i++) {
        if (docs[i].codigo == '380') factura = docs[i].referencia;
    }
    return {
        campos: campos,
        documentos: docs,
        mercancias: leerMercancias(),
        referencia: campos['Referencia DUA'],
        tipo: campos['Tipo Declaración'],
        factura: factura,
        cliente: campos['Cliente / Importador'],
        aduana: campos['Aduana de Despacho'],
        fecha: fechaHoy(),
        estado: 'Pendiente',
        usuario: sesionActual().usuario,
        historial: [{ usuario: sesionActual().usuario, fecha: fechaHoy(), estado: 'Creada' }]
    };
}

// busca el input o select que tiene esa etiqueta
function campoPorEtiqueta(etiqueta) {
    var etiquetas = document.querySelectorAll('.form-card label');
    for (var i = 0; i < etiquetas.length; i++) {
        if (etiquetas[i].textContent.trim() == etiqueta) {
            return etiquetas[i].parentNode.querySelector('input, select');
        }
    }
    return null;
}

// revisa el formulario completo.
// modo 'guardar' pide lo basico; modo 'recibo' pide ademas que este completo.
// devuelve true si todo esta bien; si no, marca los campos en rojo y muestra la lista
function validar(modo) {
    var errores = [];
    var malos = [];
    var datos = leerCampos();

    // limpiar marcas anteriores
    var marcados = document.querySelectorAll('.error');
    for (var m = 0; m < marcados.length; m++) marcados[m].classList.remove('error');

    function valor(etiqueta) {
        return limpiarEspacios(datos[etiqueta] || '');
    }
    function malo(etiqueta, mensaje) {
        errores.push(mensaje);
        var c = campoPorEtiqueta(etiqueta);
        if (c) malos.push(c);
    }

    // --- datos de la declaracion ---
    if (!PATRON.referencia.test(valor('Referencia DUA'))) {
        malo('Referencia DUA', 'Referencia DUA: obligatoria, hasta 20 letras, números, espacios o guiones');
    }
    if (valor('Manifiesto') != '' && !PATRON.referencia.test(valor('Manifiesto'))) {
        malo('Manifiesto', 'Manifiesto: solo letras, números, espacios o guiones (máx. 20)');
    }
    if (valor('Procedimiento General') != '' && !PATRON.procedimiento.test(valor('Procedimiento General'))) {
        malo('Procedimiento General', 'Procedimiento General: solo números (máx. 4 dígitos)');
    }
    if (!PATRON.aduana.test(valor('Aduana de Despacho'))) {
        malo('Aduana de Despacho', 'Aduana de Despacho: obligatoria, 4 dígitos (ejemplo 0610)');
    }
    var formularios = valor('Total Formularios');
    if (formularios != '' && !(/^[0-9]{1,3}$/.test(formularios) && Number(formularios) >= 1)) {
        malo('Total Formularios', 'Total Formularios: número entero de 1 a 999');
    }

    // --- operadores ---
    if (!largoOk(valor('Cliente / Importador'), 2, 80)) {
        malo('Cliente / Importador', 'Cliente / Importador: obligatorio (2 a 80 caracteres)');
    }
    var codigos = ['Código Consignatario', 'Código Declarante'];
    for (var c = 0; c < codigos.length; c++) {
        if (valor(codigos[c]) != '' && !PATRON.codigo.test(valor(codigos[c]))) {
            malo(codigos[c], codigos[c] + ': solo letras, números, punto, guion (máx. 15)');
        }
    }

    // --- paises (codigo de 2 letras) ---
    var paises = ['Primer Destino', 'País Comercial', 'País Exportación', 'País Destino', 'País Origen'];
    for (var p = 0; p < paises.length; p++) {
        if (valor(paises[p]) != '' && !PATRON.pais.test(valor(paises[p]))) {
            malo(paises[p], paises[p] + ': use el código de 2 letras (ejemplo US)');
        }
    }

    // --- numeros: no negativos ---
    var numeros = ['Monto Garantía', 'Valor Factura', 'Flete Internacional', 'Flete Nacional', 'Seguro',
        'Otros Gastos', 'Deducciones', 'Peso Bruto Total'];
    for (var n = 0; n < numeros.length; n++) {
        if (!numeroValido(valor(numeros[n]), true)) {
            malo(numeros[n], numeros[n] + ': debe ser un número mayor o igual a 0');
        }
    }
    // el aviso del CIF solo si los numeros individuales estaban bien
    if (errores.length == 0 && Number($('totalCIF').value) < 0) {
        malo('Total CIF', 'Total CIF: las deducciones no pueden ser mayores que el valor');
    }

    // --- documentos ---
    var docs = leerDocumentos();
    var tabla = document.querySelectorAll('.form-card table')[0];
    var filaDoc = 0;
    var hayFactura = false;
    for (var i = 0; i < tabla.rows.length; i++) {
        var celdas = tabla.rows[i].querySelectorAll('td');
        if (celdas.length == 0) continue;
        var d = docs[filaDoc++];
        var ref = limpiarEspacios(d.referencia);
        var campoRef = celdas[2].querySelector('input');
        var campoFecha = celdas[3].querySelector('input');

        if (ref.length > 40) { errores.push(d.documento + ': referencia muy larga (máx. 40)'); malos.push(campoRef); }
        if (ref != '' && d.fecha == '') { errores.push(d.documento + ': falta la fecha'); malos.push(campoFecha); }
        if (ref == '' && d.fecha != '') { errores.push(d.documento + ': falta la referencia'); malos.push(campoRef); }
        if (d.fecha != '' && !fechaValida(d.fecha)) { errores.push(d.documento + ': fecha no válida (no puede ser futura)'); malos.push(campoFecha); }
        if (d.codigo == '380' && ref != '') hayFactura = true;
    }

    // --- mercancias: se revisan solo las filas que tengan algo escrito ---
    var cuerpo = $('cuerpoMercancias');
    var conDatos = 0;
    for (var f = 0; f < cuerpo.rows.length; f++) {
        var ins = cuerpo.rows[f].querySelectorAll('input');
        var lleno = false;
        for (var k = 0; k < 8; k++) {
            if (limpiarEspacios(ins[k].value) != '') lleno = true;
        }
        if (!lleno) continue;
        conDatos++;

        var pre = 'Mercancía ' + (f + 1) + ': ';
        var bruto = Number(ins[3].value), neto = Number(ins[4].value);

        if (!PATRON.partida.test(limpiarEspacios(ins[0].value))) { errores.push(pre + 'la partida debe tener 8 dígitos'); malos.push(ins[0]); }
        if (!largoOk(limpiarEspacios(ins[1].value), 3, 200)) { errores.push(pre + 'descripción obligatoria (3 a 200 caracteres)'); malos.push(ins[1]); }
        if (!(Number(ins[2].value) > 0)) { errores.push(pre + 'la cantidad debe ser mayor que 0'); malos.push(ins[2]); }
        if (!numeroValido(ins[3].value, false)) { errores.push(pre + 'peso bruto no válido'); malos.push(ins[3]); }
        if (!numeroValido(ins[4].value, false)) { errores.push(pre + 'peso neto no válido'); malos.push(ins[4]); }
        else if (numeroValido(ins[3].value, false) && neto > bruto) { errores.push(pre + 'el peso neto no puede ser mayor que el bruto'); malos.push(ins[4]); }
        if (!numeroValido(ins[5].value, false)) { errores.push(pre + 'FOB no válido'); malos.push(ins[5]); }
        if (limpiarEspacios(ins[6].value) != '' && !PATRON.pais.test(limpiarEspacios(ins[6].value))) { errores.push(pre + 'origen: código de 2 letras'); malos.push(ins[6]); }
        if (limpiarEspacios(ins[7].value) != '' && !PATRON.procedimiento.test(limpiarEspacios(ins[7].value))) { errores.push(pre + 'procedimiento: solo números (máx. 4)'); malos.push(ins[7]); }
    }

    // --- lo que se pide solo para generar el recibo ---
    if (modo == 'recibo') {
        if (!(Number(valor('Valor Factura')) > 0)) malo('Valor Factura', 'Valor Factura: debe ser mayor que 0 para generar el recibo');
        if (conDatos == 0) errores.push('Agregue al menos una mercancía');
        if (!hayFactura) errores.push('Falta la Factura Comercial (código 380) con su referencia y fecha');
    }

    // --- que no repitan la referencia de otra declaracion ---
    if (modo == 'guardar' && PATRON.referencia.test(valor('Referencia DUA'))) {
        var lista = leerDeclaraciones();
        for (var j = 0; j < lista.length; j++) {
            var igual = String(lista[j].referencia).toLowerCase() == valor('Referencia DUA').toLowerCase();
            if (igual && lista[j].id != editandoId) {
                malo('Referencia DUA', 'Ya existe una declaración con la referencia ' + valor('Referencia DUA'));
                break;
            }
        }
    }

    if (errores.length == 0) return true;

    for (var x = 0; x < malos.length; x++) malos[x].classList.add('error');
    malos[0] && malos[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
    mostrarErrores('Revise estos datos (' + errores.length + ')', errores);
    return false;
}

// guarda una nueva, o actualiza si venimos de editar
function guardarDeclaracion() {
    if (!validar('guardar')) return;

    var registro = armarRegistro();
    var lista = leerDeclaraciones();
    var editando = editandoId;

    if (editando) {
        registro.id = Number(editando);
        for (var i = 0; i < lista.length; i++) {
            if (lista[i].id == registro.id) {
                registro.estado = lista[i].estado;
                registro.usuario = lista[i].usuario;
                registro.historial = lista[i].historial || [];
                registro.historial.push({ usuario: sesionActual().usuario, fecha: fechaHoy(), estado: 'Editada' });
                lista[i] = registro;
            }
        }
    } else {
        registro.id = nuevoId();
        lista.push(registro);
    }

    // si no se pudo guardar, guardarLista ya avisa y no seguimos
    if (!guardarDeclaraciones(lista)) return;
    editandoId = registro.id;
    mostrarAviso('Declaración ' + registro.referencia + ' guardada');
}

// si venimos de "Editar" en la busqueda, llena el formulario
function cargarParaEditar() {
    var id = localStorage.getItem(CLAVE_EDITAR);
    localStorage.removeItem(CLAVE_EDITAR);   // la marca sirve una sola vez
    if (!id) return;
    editandoId = id;

    var lista = leerDeclaraciones();
    var reg = porId(lista, id);
    if (!reg) {
        editandoId = null;
        return;
    }

    var bloques = document.querySelectorAll('.form-card .grid > div');
    for (var b = 0; b < bloques.length; b++) {
        var etiqueta = bloques[b].querySelector('label');
        var campo = bloques[b].querySelector('input, select');
        if (etiqueta && campo && reg.campos[etiqueta.textContent.trim()] !== undefined) {
            campo.value = reg.campos[etiqueta.textContent.trim()];
        }
    }

    var tabla = document.querySelectorAll('.form-card table')[0];
    var n = 0;
    for (var r = 0; r < tabla.rows.length; r++) {
        if (tabla.rows[r].querySelectorAll('td').length == 0) continue;
        var inp = tabla.rows[r].querySelectorAll('input');
        if (reg.documentos[n]) {
            inp[0].value = reg.documentos[n].referencia;
            inp[1].value = reg.documentos[n].fecha;
        }
        n++;
    }

    var cuerpo = $('cuerpoMercancias');
    while (cuerpo.rows.length < reg.mercancias.length) agregarMercancia();
    var nombres = ['partida', 'descripcion', 'cantidad', 'pesoBruto', 'pesoNeto', 'fob', 'origen', 'procedimiento'];
    for (var f = 0; f < reg.mercancias.length; f++) {
        var campos = cuerpo.rows[f].querySelectorAll('input');
        for (var c = 0; c < nombres.length; c++) campos[c].value = reg.mercancias[f][nombres[c]];
    }

    calcularCIF();
    mostrarAviso('Editando la declaración ' + reg.referencia);
}

// pone un valor en el campo que tenga esa etiqueta
function ponerCampo(etiqueta, valor, soloSiVacio) {
    var etiquetas = document.querySelectorAll('.form-card label');
    for (var i = 0; i < etiquetas.length; i++) {
        if (etiquetas[i].textContent.trim() == etiqueta) {
            var campo = etiquetas[i].parentNode.querySelector('input, select');
            if (soloSiVacio && campo.value != '') return;
            campo.value = valor;
        }
    }
}

// llena la lista de clientes guardados y rellena los datos al elegir uno
function prepararClientes() {
    var sel = $('selCliente');
    var clientes = leerLista(K.clientes);

    for (var i = 0; i < clientes.length; i++) {
        var op = document.createElement('option');
        op.value = clientes[i].id;
        op.textContent = clientes[i].codigo + ' - ' + clientes[i].nombre;
        sel.appendChild(op);
    }

    sel.onchange = function () {
        var c = porId(clientes, sel.value);
        if (c) {
            ponerCampo('Código Consignatario', c.codigo);
            ponerCampo('Cliente / Importador', c.nombre);
        }
    };
}

// partidas guardadas en el catalogo de productos
function prepararProductos() {
    var productos = leerLista(K.productos);
    var cuerpo = $('cuerpoMercancias');

    var lista = document.createElement('datalist');
    lista.id = 'listaPartidas';
    for (var i = 0; i < productos.length; i++) {
        var op = document.createElement('option');
        op.value = productos[i].partida;
        op.textContent = productos[i].descripcion;
        lista.appendChild(op);
    }
    document.body.appendChild(lista);

    for (var f = 0; f < cuerpo.rows.length; f++) {
        cuerpo.rows[f].querySelector('input').setAttribute('list', 'listaPartidas');
    }

    // al terminar de escribir la partida se completa la fila
    cuerpo.addEventListener('change', function (e) {
        var campo = e.target;
        var fila = campo.parentNode.parentNode;
        if (campo != fila.querySelector('input')) return;

        for (var j = 0; j < productos.length; j++) {
            if (productos[j].partida == campo.value.trim()) {
                var inputs = fila.querySelectorAll('input');
                if (inputs[1].value == '') inputs[1].value = productos[j].descripcion;
                if (inputs[6].value == '') inputs[6].value = productos[j].origen;
                if (inputs[7].value == '') inputs[7].value = productos[j].procedimiento;
            }
        }
    });
}

// lo que se hace al abrir la pagina de nueva declaracion
function iniciarNueva() {
    limitarCampos(document, 80);
    quitarMarcaAlEscribir();
    // la descripcion de cada mercancia puede ser mas larga
    var descripciones = document.querySelectorAll('#cuerpoMercancias tr');
    for (var q = 0; q < descripciones.length; q++) {
        descripciones[q].querySelectorAll('input')[1].setAttribute('maxlength', 200);
    }
    var camposValor = document.querySelectorAll('.calc-cif');
    for (var i = 0; i < camposValor.length; i++) {
        camposValor[i].addEventListener('input', calcularCIF);
    }
    prepararMercancias();
    prepararClientes();
    prepararProductos();

    // datos del declarante que se dejaron en Configuracion
    var conf = leerConfig();
    if (conf.codigoDeclarante) ponerCampo('Código Declarante', conf.codigoDeclarante, true);
    if (conf.aduanaDefecto) ponerCampo('Aduana de Despacho', conf.aduanaDefecto, true);

    cargarParaEditar();
}

// ============================================================
// 3. BUSCAR DECLARACION - lista, estados y acciones (antes buscar.js)
// ============================================================

// arma una fila de la tabla de resultados
function crearFila(reg) {
    var tr = document.createElement('tr');
    tr.setAttribute('data-fila', '');
    tr.setAttribute('data-id', reg.id);
    var clase = reg.estado.toLowerCase();

    tr.innerHTML =
        '<td><span class="estado ' + clase + '">' + escaparHTML(reg.estado) + '</span></td>' +
        '<td>' + escaparHTML(reg.referencia) + '</td>' +
        '<td>' + escaparHTML(reg.tipo) + '</td>' +
        '<td>' + escaparHTML(reg.factura || '-') + '</td>' +
        '<td>' + escaparHTML(reg.cliente) + '</td>' +
        '<td>' + escaparHTML(reg.proveedor || '-') + '</td>' +
        '<td>' + escaparHTML(reg.aduana) + '</td>' +
        '<td>' + escaparHTML(reg.fecha) + '</td>' +
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

// muestra el recibo de una fila (guardada o de ejemplo)
function reciboDeFila(tr) {
    var reg = buscarRegistro(tr.getAttribute('data-id'));

    // las filas de ejemplo no tienen formulario guardado, se arma con lo que hay
    if (!reg) {
        var d = datosDeFila(tr);
        reg = {
            ejemplo: true,
            campos: {
                'Referencia DUA': d.referencia, 'Tipo Declaración': d.tipo,
                'Cliente / Importador': d.cliente, 'Aduana de Despacho': d.aduana
            },
            documentos: [{ codigo: '380', documento: 'Factura Comercial', referencia: d.factura, fecha: '' }],
            mercancias: [],
            fecha: d.fecha,
            estado: d.estado
        };
    }
    mostrarRecibo(reg, { origen: 'guardada' });
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
var ICONO_BOTON = { ver: 'eye', editar: 'edit', 'estado-btn': 'check-circle', recibo: 'file-text', borrar: 'trash' };

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
    boton('Recibo', 'recibo', function () { reciboDeFila(tr); });
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
