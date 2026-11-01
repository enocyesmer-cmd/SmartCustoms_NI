// SmartCustoms NI - clientes

var clienteEditando = null;
var CAMPOS_CLIENTE = ['cCodigo', 'cNombre', 'cTipo', 'cRuc', 'cTelefono', 'cCorreo', 'cDireccion'];

// valor de un input sin espacios de mas
function valorCampo(id) {
    return document.getElementById(id).value.trim();
}

// deja el formulario vacio y sale del modo editar
function limpiarFormCliente() {
    for (var i = 0; i < CAMPOS_CLIENTE.length; i++) {
        document.getElementById(CAMPOS_CLIENTE[i]).value = '';
    }
    document.getElementById('cTipo').selectedIndex = 0;
    document.getElementById('errorCliente').textContent = '';
    document.getElementById('tituloFormCliente').textContent = 'Nuevo cliente';
    clienteEditando = null;
}

// valida y guarda (nuevo o editado)
function guardarCliente() {
    var error = document.getElementById('errorCliente');
    var lista = leerLista(K.clientes);
    var cliente = {
        id: clienteEditando || nuevoId(),
        codigo: valorCampo('cCodigo'),
        nombre: valorCampo('cNombre'),
        tipo: valorCampo('cTipo'),
        ruc: valorCampo('cRuc'),
        telefono: valorCampo('cTelefono'),
        correo: valorCampo('cCorreo'),
        direccion: valorCampo('cDireccion')
    };

    if (cliente.codigo == '' || cliente.nombre == '') {
        error.textContent = 'El código y el nombre son obligatorios';
        return;
    }
    if (cliente.correo != '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.correo)) {
        error.textContent = 'El correo no es válido';
        return;
    }
    for (var i = 0; i < lista.length; i++) {
        if (lista[i].codigo == cliente.codigo && lista[i].id != cliente.id) {
            error.textContent = 'Ya existe un cliente con ese código';
            return;
        }
    }

    if (clienteEditando) {
        for (var j = 0; j < lista.length; j++) {
            if (lista[j].id == clienteEditando) lista[j] = cliente;
        }
    } else {
        lista.push(cliente);
    }
    guardarLista(K.clientes, lista);
    limpiarFormCliente();
    mostrarClientes();
    mostrarAviso('Cliente guardado');
}

// pasa los datos del cliente al formulario
function editarCliente(id) {
    var lista = leerLista(K.clientes);
    for (var i = 0; i < lista.length; i++) {
        if (lista[i].id == id) {
            var c = lista[i];
            document.getElementById('cCodigo').value = c.codigo;
            document.getElementById('cNombre').value = c.nombre;
            document.getElementById('cTipo').value = c.tipo;
            document.getElementById('cRuc').value = c.ruc;
            document.getElementById('cTelefono').value = c.telefono;
            document.getElementById('cCorreo').value = c.correo;
            document.getElementById('cDireccion').value = c.direccion;
            clienteEditando = c.id;
            document.getElementById('tituloFormCliente').textContent = 'Editar cliente';
            window.scrollTo(0, 0);
        }
    }
}

// pregunta y elimina
function borrarCliente(id) {
    if (!confirm('¿Eliminar este cliente?')) return;
    var lista = leerLista(K.clientes).filter(function (c) { return c.id != id; });
    guardarLista(K.clientes, lista);
    mostrarClientes();
}

// dibuja la tabla aplicando el buscador
function mostrarClientes() {
    var texto = valorCampo('cBuscar').toLowerCase();
    var cuerpo = document.getElementById('listaClientes');
    var lista = leerLista(K.clientes);
    var puedeModificar = puedeModificarCatalogos(sesionActual().rol);
    var html = '';
    var cantidad = 0;

    for (var i = 0; i < lista.length; i++) {
        var c = lista[i];
        var junto = (c.codigo + ' ' + c.nombre + ' ' + c.ruc).toLowerCase();
        if (texto && junto.indexOf(texto) == -1) continue;
        cantidad++;

        html += '<tr>' +
            '<td>' + escaparXML(c.codigo) + '</td>' +
            '<td>' + escaparXML(c.nombre) + '</td>' +
            '<td>' + escaparXML(c.tipo) + '</td>' +
            '<td>' + escaparXML(c.ruc || '-') + '</td>' +
            '<td>' + escaparXML(c.telefono || '-') + '</td>' +
            '<td>' + escaparXML(c.correo || '-') + '</td>' +
            '<td class="acciones">';
        if (puedeModificar) {
            html += '<button class="editar" onclick="editarCliente(' + c.id + ')">' + icono('edit') + 'Editar</button>' +
                '<button class="borrar" onclick="borrarCliente(' + c.id + ')">' + icono('trash') + 'Eliminar</button>';
        }
        html += '</td></tr>';
    }

    if (cantidad == 0) {
        html = '<tr><td colspan="7" class="sin-datos">No hay clientes para mostrar.</td></tr>';
    }
    cuerpo.innerHTML = html;
    etiquetarTablas();
}

document.addEventListener('DOMContentLoaded', function () {
    if (window.sinAcceso) return;

    // el revisor solo consulta
    if (!puedeModificarCatalogos(sesionActual().rol)) {
        document.getElementById('formCliente').style.display = 'none';
    }
    document.getElementById('btnGuardarCliente').onclick = guardarCliente;
    document.getElementById('btnLimpiarCliente').onclick = limpiarFormCliente;
    document.getElementById('cBuscar').addEventListener('input', mostrarClientes);
    mostrarClientes();
});
