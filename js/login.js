// SmartCustoms NI - pagina de login

// si ya hay sesion no tiene sentido mostrar el login
if (sesionActual()) {
    window.location.replace('index.html');
}

pintarIconos();   // los iconos que estan escritos en el html (<i data-ico>)

// ojito: alterna entre ocultar y mostrar la contraseña
$('verClave').addEventListener('click', function () {
    var campo = $('clave');
    campo.type = (campo.type == 'password') ? 'text' : 'password';
});

$('formLogin').addEventListener('submit', function (e) {
    e.preventDefault();   // para que el formulario no recargue la pagina

    var usuario = $('usuario').value.trim();
    var clave = $('clave').value;
    var error = $('errorLogin');

    if (usuario == '' || clave == '') {
        error.textContent = 'Escriba el usuario y la contraseña';
        return;
    }

    var mensaje = iniciarSesion(usuario, clave);
    if (mensaje != '') {
        error.textContent = mensaje;
        $('clave').value = '';   // se borra la clave por si se equivoco
        return;
    }
    window.location.href = 'index.html';
});
