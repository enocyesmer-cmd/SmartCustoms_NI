// SmartCustoms NI - productos y partidas arancelarias
// la logica comun esta en catalogo.js

var CATALOGO = {
    nombre: 'producto', plural: 'productos', clave: K.productos, guardado: 'Producto guardado',
    form: 'formProducto', error: 'errorProducto', titulo: 'tituloFormProducto',
    guardar: 'btnGuardarProducto', limpiar: 'btnLimpiarProducto', buscar: 'pBuscar', cuerpo: 'listaProductos',
    maximo: 150,
    columnas: ['partida', 'descripcion', 'origen', 'procedimiento'],
    buscarEn: ['partida', 'descripcion'],
    duplicado: { prop: 'partida', mensaje: 'Esa partida ya está en el catálogo' },
    campos: [
        { id: 'pPartida', prop: 'partida', max: 8, valida: function (v) { return PATRON.partida.test(v) ? '' : 'La partida debe tener exactamente 8 dígitos'; } },
        { id: 'pDescripcion', prop: 'descripcion', valida: function (v) { return largoOk(v, 3, 150) ? '' : 'La descripción es obligatoria (3 a 150 caracteres)'; } },
        { id: 'pOrigen', prop: 'origen', max: 2, mayus: true, valida: function (v) { return v == '' || PATRON.pais.test(v) ? '' : 'El origen debe ser un código de 2 letras, por ejemplo US'; } },
        { id: 'pProc', prop: 'procedimiento', max: 4, def: '4000', valida: function (v) { return v == '' || PATRON.procedimiento.test(v) ? '' : 'El procedimiento solo lleva números (máx. 4 dígitos)'; } }
    ]
};
