// SmartCustoms NI - productos y partidas arancelarias

var productoEditando = null;

// valor de un input sin espacios de mas
function valorProd(id) {
    return document.getElementById(id).value.trim();
}

// deja el formulario vacio y sale del modo editar
function limpiarFormProducto() {
    document.getElementById('pPartida').value = '';
    document.getElementById('pDescripcion').value = '';
    document.getElementById('pOrigen').value = '';
    document.getElementById('pProc').value = '4000';
    document.getElementById('errorProducto').textContent = '';
    document.getElementById('tituloFormProducto').textContent = 'Nuevo producto';
    productoEditando = null;
}

// valida partida (8 digitos), origen (2 letras) y guarda
function guardarProducto() {
    var error = document.getElementById('errorProducto');
    var lista = leerLista(K.productos);
    var prod = {
        id: productoEditando || nuevoId(),
        partida: valorProd('pPartida'),
        descripcion: valorProd('pDescripcion'),
        origen: valorProd('pOrigen').toUpperCase(),
        procedimiento: valorProd('pProc')
    };

    if (!/^[0-9]{8}$/.test(prod.partida)) {
        error.textContent = 'La partida debe tener 8 dígitos';
        return;
    }
    if (prod.descripcion == '') {
        error.textContent = 'Escriba la descripción';
        return;
    }
    if (prod.origen != '' && !/^[A-Z]{2}$/.test(prod.origen)) {
        error.textContent = 'El origen debe ser un código de 2 letras, por ejemplo US';
        return;
    }
    for (var i = 0; i < lista.length; i++) {
        if (lista[i].partida == prod.partida && lista[i].id != prod.id) {
            error.textContent = 'Esa partida ya está en el catálogo';
            return;
        }
    }

    if (productoEditando) {
        for (var j = 0; j < lista.length; j++) {
            if (lista[j].id == productoEditando) lista[j] = prod;
        }
    } else {
        lista.push(prod);
    }
    guardarLista(K.productos, lista);
    limpiarFormProducto();
    mostrarProductos();
    mostrarAviso('Producto guardado');
}

// pasa los datos del producto al formulario
function editarProducto(id) {
    var lista = leerLista(K.productos);
    for (var i = 0; i < lista.length; i++) {
        if (lista[i].id == id) {
            document.getElementById('pPartida').value = lista[i].partida;
            document.getElementById('pDescripcion').value = lista[i].descripcion;
            document.getElementById('pOrigen').value = lista[i].origen;
            document.getElementById('pProc').value = lista[i].procedimiento;
            productoEditando = lista[i].id;
            document.getElementById('tituloFormProducto').textContent = 'Editar producto';
            window.scrollTo(0, 0);
        }
    }
}

// pregunta y elimina
function borrarProducto(id) {
    if (!confirm('¿Eliminar este producto?')) return;
    var lista = leerLista(K.productos).filter(function (p) { return p.id != id; });
    guardarLista(K.productos, lista);
    mostrarProductos();
}

// dibuja la tabla aplicando el buscador
function mostrarProductos() {
    var texto = valorProd('pBuscar').toLowerCase();
    var lista = leerLista(K.productos);
    var puedeModificar = puedeModificarCatalogos(sesionActual().rol);
    var html = '';
    var cantidad = 0;

    for (var i = 0; i < lista.length; i++) {
        var p = lista[i];
        if (texto && (p.partida + ' ' + p.descripcion).toLowerCase().indexOf(texto) == -1) continue;
        cantidad++;

        html += '<tr>' +
            '<td>' + escaparXML(p.partida) + '</td>' +
            '<td>' + escaparXML(p.descripcion) + '</td>' +
            '<td>' + escaparXML(p.origen || '-') + '</td>' +
            '<td>' + escaparXML(p.procedimiento || '-') + '</td>' +
            '<td class="acciones">';
        if (puedeModificar) {
            html += '<button class="editar" onclick="editarProducto(' + p.id + ')">' + icono('edit') + 'Editar</button>' +
                '<button class="borrar" onclick="borrarProducto(' + p.id + ')">' + icono('trash') + 'Eliminar</button>';
        }
        html += '</td></tr>';
    }

    if (cantidad == 0) {
        html = '<tr><td colspan="5" class="sin-datos">No hay productos para mostrar.</td></tr>';
    }
    document.getElementById('listaProductos').innerHTML = html;
    etiquetarTablas();
}

document.addEventListener('DOMContentLoaded', function () {
    if (window.sinAcceso) return;

    if (!puedeModificarCatalogos(sesionActual().rol)) {
        document.getElementById('formProducto').style.display = 'none';
    }
    document.getElementById('btnGuardarProducto').onclick = guardarProducto;
    document.getElementById('btnLimpiarProducto').onclick = limpiarFormProducto;
    document.getElementById('pBuscar').addEventListener('input', mostrarProductos);
    mostrarProductos();
});
