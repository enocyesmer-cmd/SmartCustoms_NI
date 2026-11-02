// SmartCustoms NI - clientes (importadores y consignatarios)
// la logica comun esta en catalogo.js

var CATALOGO = {
    nombre: 'cliente', plural: 'clientes', clave: K.clientes, guardado: 'Cliente guardado',
    form: 'formCliente', error: 'errorCliente', titulo: 'tituloFormCliente',
    guardar: 'btnGuardarCliente', limpiar: 'btnLimpiarCliente', buscar: 'cBuscar', cuerpo: 'listaClientes',
    maximo: 80,
    columnas: ['codigo', 'nombre', 'tipo', 'ruc', 'telefono', 'correo'],
    buscarEn: ['codigo', 'nombre', 'ruc'],
    duplicado: { prop: 'codigo', mensaje: 'Ya existe un cliente con ese código' },
    campos: [
        { id: 'cCodigo', prop: 'codigo', valida: function (v) { return PATRON.codigo.test(v) ? '' : 'El código es obligatorio: letras, números, punto o guion (máx. 15)'; } },
        { id: 'cNombre', prop: 'nombre', valida: function (v) { return largoOk(v, 2, 80) ? '' : 'El nombre es obligatorio (2 a 80 caracteres)'; } },
        { id: 'cTipo', prop: 'tipo', valida: function (v) { return ['Importador', 'Consignatario', 'Ambos'].indexOf(v) != -1 ? '' : 'Elija un tipo válido'; } },
        { id: 'cRuc', prop: 'ruc', valida: function (v) { return v == '' || PATRON.ruc.test(v) ? '' : 'El RUC solo lleva letras, números y guiones (3 a 20)'; } },
        { id: 'cTelefono', prop: 'telefono', valida: function (v) { return v == '' || PATRON.telefono.test(v) ? '' : 'El teléfono no es válido (solo números, +, guiones y paréntesis)'; } },
        { id: 'cCorreo', prop: 'correo', valida: function (v) { return v == '' || (PATRON.correo.test(v) && v.length <= 80) ? '' : 'El correo no es válido'; } },
        { id: 'cDireccion', prop: 'direccion', max: 120, valida: function (v) { return v.length <= 120 ? '' : 'La dirección es muy larga (máx. 120)'; } }
    ]
};
