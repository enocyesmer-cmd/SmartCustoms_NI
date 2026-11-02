// SmartCustoms NI - pagina de nueva declaracion

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
// modo 'guardar' pide lo basico; modo 'xml' pide ademas que este completo.
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

    // --- lo que se pide solo para generar el xml ---
    if (modo == 'xml') {
        if (!(Number(valor('Valor Factura')) > 0)) malo('Valor Factura', 'Valor Factura: debe ser mayor que 0 para generar el XML');
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
