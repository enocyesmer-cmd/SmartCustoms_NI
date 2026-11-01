// SmartCustoms NI - pagina de login

// si ya hay sesion no tiene sentido mostrar el login
if (sesionActual()) {
    window.location.replace('index.html');
}

document.getElementById('formLogin').addEventListener('submit', function (e) {
    e.preventDefault();   // para que el formulario no recargue la pagina

    var usuario = document.getElementById('usuario').value.trim();
    var clave = document.getElementById('clave').value;
    var error = document.getElementById('errorLogin');

    if (usuario == '' || clave == '') {
        error.textContent = 'Escriba el usuario y la contraseña';
        return;
    }

    var mensaje = iniciarSesion(usuario, clave);
    if (mensaje != '') {
        error.textContent = mensaje;
        document.getElementById('clave').value = '';   // se borra la clave por si se equivoco
        return;
    }
    window.location.href = 'index.html';
});
