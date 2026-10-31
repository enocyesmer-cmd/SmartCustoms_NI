// SmartCustoms NI - funciones generales

var CLAVE = 'smartcustoms_declaraciones';   
var CLAVE_EDITAR = 'smartcustoms_editar';
var editandoId = null;                     



function dibujarMenu() {
    var pagina = document.body.getAttribute('data-pagina');
    var enDecl = (pagina == 'nueva' || pagina == 'buscar');
    var ses = sesionActual();
    var rol = ses.rol;

    
    function item(clave, texto, enlace) {
        if (!puedeVerPagina(clave, rol)) return '';
        return '<li class="' + (pagina == clave ? 'activo' : '') + '"><a href="' + enlace + '">' + texto + '</a></li>';
    }

    var html = '';
    html += '<div class="logo"><img src="img/logo-recortado.png" alt="SmartCustoms NI"></div>';
    html += '<ul>';
    html += item('inicio', 'Dashboard', 'index.html');
    html += item('clientes', 'Clientes', 'clientes.html');
    html += item('productos', 'Productos', 'productos.html');

    html += '<li class="' + (enDecl ? 'activo abierto' : '') + '" id="itemDeclaraciones">';
    html += '<span id="btnDecl">Declaraciones <b class="flecha">&#9660;</b></span>';
    html += '<ul id="submenuDeclaraciones" class="submenu' + (enDecl ? ' show' : '') + '">';
    html += item('nueva', 'Nueva Declaración', 'nueva_declaracion.html');
    html += item('buscar', 'Buscar Declaración', 'buscar_declaracion.html');
    html += '</ul></li>';

    html += item('reportes', 'Reportes', 'reportes.html');
    html += '<li><span onclick="mostrarAviso(\'SIDUNEA World: próximamente\')">SIDUNEA World</span></li>';
    html += '<li><span onclick="mostrarAviso(\'IA Arancelaria: próximamente\')">IA Arancelaria</span></li>';
    html += item('configuracion', 'Configuración', 'configuracion.html');
    html += '</ul>';

    html += '<div class="usuario-box">';
    html += '<b>' + escaparXML(ses.nombre) + '</b>';
    html += '<small>' + ses.rol + '</small>';
    html += '<button id="btnClave" class="btn-claro">Cambiar contraseña</button>';
    html += '<button id="btnSalirMenu" class="btn-claro">Cerrar sesión</button>';
    html += '</div>';

    document.getElementById('menu').innerHTML = html;
    document.getElementById('btnDecl').onclick = toggleMenu;
    document.getElementById('btnClave').onclick = cambiarClave;
    document.getElementById('btnSalirMenu').onclick = cerrarSesion;
}

function toggleMenu() {
    document.getElementById('submenuDeclaraciones').classList.toggle('show');
}



function menuAbierto() {
    return document.getElementById('menu').classList.contains('abierta');
}

function abrirMenuMovil() {
    document.getElementById('menu').classList.add('abierta');
    document.getElementById('fondoMenu').classList.add('visible');
}

function cerrarMenuMovil() {
    document.getElementById('menu').classList.remove('abierta');
    document.getElementById('fondoMenu').classList.remove('visible');
}

function prepararMovil() {
    var fondo = document.createElement('div');
    fondo.id = 'fondoMenu';
    fondo.className = 'fondo-menu';
    document.body.appendChild(fondo);

    fondo.onclick = cerrarMenuMovil;
    document.getElementById('btnMenu').onclick = function () {
        if (menuAbierto()) cerrarMenuMovil();
        else abrirMenuMovil();
    };

    // al tocar un enlace del menu se cierra
    document.getElementById('menu').addEventListener('click', function (e) {
        if (e.target.tagName == 'A') cerrarMenuMovil();
    });

    // si giran el telefono o agrandan la ventana
    window.addEventListener('resize', function () {
        if (window.innerWidth > 800) cerrarMenuMovil();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key == 'Escape') cerrarMenuMovil();
    });
}


function etiquetarTablas() {
    var tablas = document.querySelectorAll('table');
    for (var t = 0; t < tablas.length; t++) {
        var ths = tablas[t].querySelectorAll('th');
        if (ths.length == 0) continue;
        tablas[t].classList.add('apilar');

        var filas = tablas[t].querySelectorAll('tr');
        for (var f = 0; f < filas.length; f++) {
            var celdas = filas[f].querySelectorAll('td');
            for (var c = 0; c < celdas.length; c++) {
                if (ths[c] && !celdas[c].hasAttribute('colspan')) celdas[c].setAttribute('data-label', ths[c].textContent);
            }
        }
    }
}



function mostrarAviso(texto) {
    var aviso = document.getElementById('aviso');
    if (!aviso) {
        aviso = document.createElement('div');
        aviso.id = 'aviso';
        aviso.className = 'aviso';
        document.body.appendChild(aviso);
    }
    aviso.textContent = texto;
    aviso.classList.add('ver-aviso');
    clearTimeout(aviso.temporizador);
    aviso.temporizador = setTimeout(function () {
        aviso.classList.remove('ver-aviso');
    }, 2800);
}

function leerDeclaraciones() {
    try {
        return JSON.parse(localStorage.getItem(CLAVE)) || [];
    } catch (e) {
        return [];
    }
}

function guardarDeclaraciones(lista) {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
}

function fechaHoy() {
    var d = new Date();
    var dia = ('0' + d.getDate()).slice(-2);
    var mes = ('0' + (d.getMonth() + 1)).slice(-2);
    return dia + '/' + mes + '/' + d.getFullYear();
}

function limpiarTexto(t) {
    // para nombres de etiquetas xml: sin tildes ni espacios
    return t.normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function escaparXML(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function descargar(nombre, contenido) {
    var blob = new Blob([contenido], { type: 'application/xml' });
    var enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
}

// ventana de detalle
function mostrarVentana(titulo, filas) {
    var fondo = document.getElementById('modalFondo');
    if (!fondo) {
        fondo = document.createElement('div');
        fondo.id = 'modalFondo';
        fondo.className = 'modal-fondo';
        fondo.onclick = function (e) {
            if (e.target == fondo) fondo.classList.remove('visible');
        };
        document.body.appendChild(fondo);
    }
    var html = '<div class="modal"><h2>' + escaparXML(titulo) + '</h2><table>';
    for (var i = 0; i < filas.length; i++) {
        html += '<tr><td>' + escaparXML(filas[i][0]) + '</td><td>' + escaparXML(filas[i][1] || '-') + '</td></tr>';
    }
    html += '</table><div class="botones"><button onclick="document.getElementById(\'modalFondo\').classList.remove(\'visible\')">Cerrar</button></div></div>';
    fondo.innerHTML = html;
    fondo.classList.add('visible');
}


function cambiarClave() {
    var fondo = document.getElementById('modalFondo');
    if (!fondo) {
        fondo = document.createElement('div');
        fondo.id = 'modalFondo';
        fondo.className = 'modal-fondo';
        document.body.appendChild(fondo);
    }
    fondo.innerHTML = '<div class="modal"><h2>Cambiar contraseña</h2>' +
        '<label>Contraseña actual</label><input type="password" id="claveActual">' +
        '<label style="margin-top:10px">Contraseña nueva (mínimo 6 caracteres)</label><input type="password" id="claveNueva">' +
        '<label style="margin-top:10px">Repetir contraseña nueva</label><input type="password" id="claveRepetida">' +
        '<p id="errorClave" class="error-texto"></p>' +
        '<div class="botones"><button id="btnGuardarClave">Guardar</button>' +
        '<button class="volver" id="btnCancelarClave">Cancelar</button></div></div>';
    fondo.classList.add('visible');

    document.getElementById('btnCancelarClave').onclick = function () {
        fondo.classList.remove('visible');
    };
    document.getElementById('btnGuardarClave').onclick = function () {
        var actual = document.getElementById('claveActual').value;
        var nueva = document.getElementById('claveNueva').value;
        var repetida = document.getElementById('claveRepetida').value;
        var error = document.getElementById('errorClave');
        var ses = sesionActual();
        var lista = leerLista(K.usuarios);
        var u = null;
        for (var i = 0; i < lista.length; i++) {
            if (lista[i].id == ses.id) u = lista[i];
        }

        if (u.claveHash != hashClave(actual)) { error.textContent = 'La contraseña actual no es correcta'; return; }
        if (nueva.length < 6) { error.textContent = 'La nueva contraseña es muy corta'; return; }
        if (nueva != repetida) { error.textContent = 'Las contraseñas nuevas no coinciden'; return; }

        u.claveHash = hashClave(nueva);
        guardarLista(K.usuarios, lista);
        fondo.classList.remove('visible');
        mostrarAviso('Contraseña actualizada');
    };
}

function sumarXML() {
    var n = parseInt(localStorage.getItem(K.xml)) || 0;
    localStorage.setItem(K.xml, n + 1);
}



function numero(id) {
    var campo = document.getElementById(id);
    if (!campo) return 0;
    return parseFloat(campo.value) || 0;
}


function calcularCIF() {
    var total = numero('valorFactura') + numero('fleteInternacional') +
        numero('fleteNacional') + numero('seguro') +
        numero('otrosGastos') - numero('deducciones');
    document.getElementById('totalCIF').value = total.toFixed(2);
}

function filaQuitar() {
    
    var td = document.createElement('td');
    td.setAttribute('data-label', 'Acción');
    td.innerHTML = '<button class="quitar" type="button">Quitar</button>';
    td.firstChild.onclick = function () {
        quitarMercancia(this.parentNode.parentNode);
    };
    return td;
}

function prepararMercancias() {
    var cuerpo = document.getElementById('cuerpoMercancias');
    var encabezado = cuerpo.parentNode.querySelector('thead tr');
    var th = document.createElement('th');
    th.textContent = 'Acción';
    encabezado.appendChild(th);

    for (var i = 0; i < cuerpo.rows.length; i++) {
        cuerpo.rows[i].appendChild(filaQuitar());
    }
}

function agregarMercancia() {
    var cuerpo = document.getElementById('cuerpoMercancias');
    var fila = cuerpo.rows[0].cloneNode(true);
    var campos = fila.querySelectorAll('input');

    for (var i = 0; i < campos.length; i++) {
        campos[i].value = '';
        campos[i].removeAttribute('placeholder');
    }
    
    fila.removeChild(fila.lastChild);
    fila.appendChild(filaQuitar());
    cuerpo.appendChild(fila);
}

function quitarMercancia(fila) {
    var cuerpo = document.getElementById('cuerpoMercancias');
    if (cuerpo.rows.length == 1) {
        mostrarAviso('Debe quedar al menos una mercancía');
        return;
    }
    cuerpo.removeChild(fila);
}


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

function leerMercancias() {
    var lista = [];
    var cuerpo = document.getElementById('cuerpoMercancias');
    var nombres = ['partida', 'descripcion', 'cantidad', 'pesoBruto', 'pesoNeto', 'fob', 'origen', 'procedimiento'];

    for (var i = 0; i < cuerpo.rows.length; i++) {
        var inputs = cuerpo.rows[i].querySelectorAll('input');
        var m = {};
        for (var j = 0; j < nombres.length; j++) m[nombres[j]] = inputs[j].value;
        lista.push(m);
    }
    return lista;
}

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

// revisa lo minimo antes de guardar o generar xml
function validar() {
    var ok = true;
    var obligatorios = ['Referencia DUA', 'Aduana de Despacho', 'Cliente / Importador'];
    var etiquetas = document.querySelectorAll('.form-card label');

    for (var i = 0; i < etiquetas.length; i++) {
        var texto = etiquetas[i].textContent.trim();
        if (obligatorios.indexOf(texto) == -1) continue;
        var campo = etiquetas[i].parentNode.querySelector('input');
        if (campo.value.trim() == '') {
            campo.classList.add('error');
            ok = false;
        } else {
            campo.classList.remove('error');
        }
    }
    if (!ok) mostrarAviso('Complete los campos obligatorios: Referencia DUA, Aduana y Cliente');
    return ok;
}

function guardarDeclaracion() {
    if (!validar()) return;

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
        registro.id = Date.now();
        lista.push(registro);
    }

    guardarDeclaraciones(lista);
    editandoId = registro.id;
    mostrarAviso('Declaración ' + registro.referencia + ' guardada');
}

function construirXML(registro, tipo) {
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<Declaracion tipo="' + tipo + '">\n';

    for (var etiqueta in registro.campos) {
        var nombre = limpiarTexto(etiqueta);
        xml += '  <' + nombre + '>' + escaparXML(registro.campos[etiqueta]) + '</' + nombre + '>\n';
    }

    xml += '  <Documentos>\n';
    for (var i = 0; i < registro.documentos.length; i++) {
        var d = registro.documentos[i];
        xml += '    <Documento codigo="' + escaparXML(d.codigo) + '">\n';
        xml += '      <Nombre>' + escaparXML(d.documento) + '</Nombre>\n';
        xml += '      <Referencia>' + escaparXML(d.referencia) + '</Referencia>\n';
        xml += '      <Fecha>' + escaparXML(d.fecha) + '</Fecha>\n';
        xml += '    </Documento>\n';
    }
    xml += '  </Documentos>\n';

    xml += '  <Mercancias>\n';
    for (var j = 0; j < registro.mercancias.length; j++) {
        var m = registro.mercancias[j];
        xml += '    <Mercancia numero="' + (j + 1) + '">\n';
        for (var k in m) {
            var n = k.charAt(0).toUpperCase() + k.slice(1);
            xml += '      <' + n + '>' + escaparXML(m[k]) + '</' + n + '>\n';
        }
        xml += '    </Mercancia>\n';
    }
    xml += '  </Mercancias>\n';
    xml += '</Declaracion>\n';
    return xml;
}

function generarXML(tipo) {
    if (!validar()) return;
    var registro = armarRegistro();
    var nombre = tipo + '_' + registro.referencia + '.xml';
    descargar(nombre, construirXML(registro, tipo));
    sumarXML();
    mostrarAviso('Se generó ' + nombre);
}

// si venimos de "Editar" en la busqueda, llena el formulario
function cargarParaEditar() {
    var id = localStorage.getItem(CLAVE_EDITAR);
    localStorage.removeItem(CLAVE_EDITAR);   // la marca sirve una sola vez
    if (!id) return;
    editandoId = id;

    var lista = leerDeclaraciones();
    var reg = null;
    for (var i = 0; i < lista.length; i++) {
        if (lista[i].id == id) reg = lista[i];
    }
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

    var cuerpo = document.getElementById('cuerpoMercancias');
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
    var sel = document.getElementById('selCliente');
    var clientes = leerLista(K.clientes);

    for (var i = 0; i < clientes.length; i++) {
        var op = document.createElement('option');
        op.value = clientes[i].id;
        op.textContent = clientes[i].codigo + ' - ' + clientes[i].nombre;
        sel.appendChild(op);
    }

    sel.onchange = function () {
        for (var j = 0; j < clientes.length; j++) {
            if (clientes[j].id == sel.value) {
                ponerCampo('Código Consignatario', clientes[j].codigo);
                ponerCampo('Cliente / Importador', clientes[j].nombre);
            }
        }
    };
}

// partidas guardadas en el catalogo de productos
function prepararProductos() {
    var productos = leerLista(K.productos);
    var cuerpo = document.getElementById('cuerpoMercancias');

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

function iniciarNueva() {
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



function convertirFecha(texto) {
    // la tabla trae dd/mm/yyyy, el input date trae yyyy-mm-dd
    var p = texto.split('/');
    return p[2] + '-' + p[1] + '-' + p[0];
}

function buscarRegistro(id) {
    var lista = leerDeclaraciones();
    for (var i = 0; i < lista.length; i++) {
        if (lista[i].id == id) return lista[i];
    }
    return null;
}

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
    descargar('DUA_' + reg.campos['Referencia DUA'] + '.xml', construirXML(reg, 'DUA'));
    sumarXML();
    mostrarAviso('XML descargado');
}

// el declarante solo toca las suyas y mientras esten pendientes; el admin todas
function puedeEditarRegistro(reg) {
    var ses = sesionActual();
    if (ses.rol == 'administrador') return true;
    return ses.rol == 'declarante' && reg.usuario == ses.usuario && reg.estado == 'Pendiente';
}

function cambiarEstado(tr) {
    var id = tr.getAttribute('data-id');
    var lista = leerDeclaraciones();
    var siguiente = { 'Pendiente': 'Revisado', 'Revisado': 'Aprobado', 'Aprobado': 'Pendiente' };

    for (var i = 0; i < lista.length; i++) {
        if (lista[i].id == id) {
            lista[i].estado = siguiente[lista[i].estado];
            lista[i].historial = lista[i].historial || [];
            lista[i].historial.push({ usuario: sesionActual().usuario, fecha: fechaHoy(), estado: lista[i].estado });

            var nueva = crearFila(lista[i]);
            tr.parentNode.replaceChild(nueva, tr);
            ponerAcciones(nueva);
        }
    }
    guardarDeclaraciones(lista);
    etiquetarTablas();
    buscarDeclaraciones();
}

function ponerAcciones(tr) {
    var celda = tr.querySelector('.acciones');
    var reg = buscarRegistro(tr.getAttribute('data-id'));
    var ses = sesionActual();
    celda.innerHTML = '';

    function boton(texto, clase, fn) {
        var b = document.createElement('button');
        b.textContent = texto;
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

function eliminarDeclaracion(tr) {
    if (!confirm('¿Eliminar la declaración ' + tr.cells[1].textContent + '?')) return;
    var id = tr.getAttribute('data-id');
    var lista = leerDeclaraciones().filter(function (r) { return r.id != id; });
    guardarDeclaraciones(lista);
    tr.parentNode.removeChild(tr);
    buscarDeclaraciones();
}

function iniciarBusqueda() {
    var cuerpo = document.getElementById('resultados');
    var sinDatos = document.getElementById('sinDatos');
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
    var ids = ['fRef', 'fFactura', 'fCliente', 'fDesde', 'fHasta'];
    for (var k = 0; k < ids.length; k++) {
        document.getElementById(ids[k]).addEventListener('input', buscarDeclaraciones);
    }
    sinDatos.style.display = 'none';
}

function buscarDeclaraciones() {
    var ref = document.getElementById('fRef').value.toLowerCase();
    var fac = document.getElementById('fFactura').value.toLowerCase();
    var cli = document.getElementById('fCliente').value.toLowerCase();
    var desde = document.getElementById('fDesde').value;
    var hasta = document.getElementById('fHasta').value;

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
    document.getElementById('sinDatos').style.display = visibles == 0 ? '' : 'none';
}

function limpiarFiltros() {
    var ids = ['fRef', 'fFactura', 'fCliente', 'fDesde', 'fHasta'];
    for (var i = 0; i < ids.length; i++) {
        document.getElementById(ids[i]).value = '';
    }
    buscarDeclaraciones();
}


function iniciarInicio() {
    var ses = sesionActual();
    var lista = leerDeclaraciones();
    var hoy = fechaHoy();
    var deHoy = 0, aprobadas = 0;

    for (var i = 0; i < lista.length; i++) {
        if (lista[i].fecha == hoy) deHoy++;
        if (lista[i].estado == 'Aprobado') aprobadas++;
    }

    document.getElementById('statHoy').textContent = deHoy;
    document.getElementById('statXml').textContent = parseInt(localStorage.getItem(K.xml)) || 0;
    document.getElementById('statClientes').textContent = leerLista(K.clientes).length;
    document.getElementById('statAprobadas').textContent =
        (lista.length == 0 ? 0 : Math.round(aprobadas * 100 / lista.length)) + '%';

    document.getElementById('saludo').textContent = 'Bienvenido, ' + ses.nombre + ' (' + ses.rol + ')';
    document.getElementById('btnSalir').onclick = cerrarSesion;

    var total = lista.length;
    document.getElementById('resumenGuardadas').textContent = total == 0 ?
        'Todavía no hay declaraciones guardadas.' :
        'Hay ' + total + ' declaración(es) guardada(s) en este equipo.';

    if (window.location.search.indexOf('sinpermiso') != -1) {
        mostrarAviso('No tiene permiso para entrar a esa página');
    }
}



document.addEventListener('DOMContentLoaded', function () {
    if (window.sinAcceso) return;   // ya lo mando al login

    var pagina = document.body.getAttribute('data-pagina');

    dibujarMenu();
    prepararMovil();

    if (pagina == 'nueva') iniciarNueva();
    if (pagina == 'buscar') iniciarBusqueda();
    if (pagina == 'inicio') iniciarInicio();

    etiquetarTablas();
});
