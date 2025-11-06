import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { auth } from '../services/firebase';

const Perfil = () => {
  const { currentUser, userRole } = useAuth();

  // Estados para el nombre
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [loadingName, setLoadingName] = useState(false);
  const [successName, setSuccessName] = useState('');
  const [errorName, setErrorName] = useState('');

  // Estados para la contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [successPassword, setSuccessPassword] = useState('');
  const [errorPassword, setErrorPassword] = useState('');

  // 1. Manejar actualización de nombre
  const handleUpdateName = async (e) => {
    e.preventDefault();
    setErrorName('');
    setSuccessName('');
    setLoadingName(true);

    if (displayName.trim() === currentUser.displayName) {
      setLoadingName(false);
      return; // No hay cambios
    }

    try {
      await updateProfile(currentUser, {
        displayName: displayName.trim()
      });
      setSuccessName('¡Nombre actualizado con éxito!');
      // Forzar recarga del token para que AuthContext vea el cambio
      await currentUser.getIdToken(true);
    } catch (error) {
      console.error("Error al actualizar nombre:", error);
      setErrorName('Error al actualizar el nombre.');
    } finally {
      setLoadingName(false);
    }
  };

  // 2. Manejar actualización de contraseña
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setErrorPassword('');
    setSuccessPassword('');

    if (newPassword !== confirmPassword) {
      setErrorPassword('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (!currentPassword) {
      setErrorPassword('Debes ingresar tu contraseña actual.');
      return;
    }

    setLoadingPassword(true);

    try {
      // Re-autenticar al usuario es un requisito de seguridad
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // Si la re-autenticación es exitosa, cambiar la contraseña
      await updatePassword(currentUser, newPassword);

      setSuccessPassword('¡Contraseña actualizada con éxito!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error("Error al actualizar contraseña:", error);
      if (error.code === 'auth/wrong-password') {
        setErrorPassword('La contraseña actual es incorrecta.');
      } else if (error.code === 'auth/weak-password') {
        setErrorPassword('La contraseña nueva debe tener al menos 6 caracteres.');
      } else {
        setErrorPassword('Error al actualizar la contraseña.');
      }
    } finally {
      setLoadingPassword(false);
    }
  };

  const getRoleName = () => {
    return userRole === 'admin' ? 'Administrador' : 'Vendedor';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Mi Perfil</h1>
        <p className="text-gray-600 mt-1">Gestiona tu información personal y seguridad.</p>
      </div>

      {/* Tarjeta de Información General */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Información de Cuenta</h2>
        <div className="space-y-3">
          <div className="flex">
            <span className="w-32 text-sm font-medium text-gray-500">Email</span>
            <span className="text-gray-800">{currentUser.email}</span>
          </div>
          <div className="flex">
            <span className="w-32 text-sm font-medium text-gray-500">Rol</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${userRole === 'admin' ? 'bg-pink-100 text-pink-800' : 'bg-gray-100 text-gray-800'}`}>
              {getRoleName()}
            </span>
          </div>
        </div>
      </div>

      {/* Formulario de Actualizar Nombre */}
      <div className="bg-white rounded-lg shadow-md">
        <form onSubmit={handleUpdateName}>
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Actualizar Nombre</h2>
            <p className="text-sm text-gray-600 mb-4">
              Este nombre se mostrará en lugar de tu email en el saludo del dashboard.
            </p>
            {successName && <div className="bg-green-100 text-green-700 p-3 rounded mb-4">{successName}</div>}
            {errorName && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{errorName}</div>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="displayName">
                Nombre a Mostrar
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ej: Braihan Cortes"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="bg-gray-50 px-6 py-3 text-right rounded-b-lg">
            <button
              type="submit"
              disabled={loadingName}
              style={{ backgroundColor: '#D50565' }}
              className="px-6 py-2 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loadingName ? 'Guardando...' : 'Guardar Nombre'}
            </button>
          </div>
        </form>
      </div>

      {/* Formulario de Cambiar Contraseña */}
      <div className="bg-white rounded-lg shadow-md">
        <form onSubmit={handleUpdatePassword}>
          <div className="p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">Cambiar Contraseña</h2>

            {successPassword && <div className="bg-green-100 text-green-700 p-3 rounded">{successPassword}</div>}
            {errorPassword && <div className="bg-red-100 text-red-700 p-3 rounded">{errorPassword}</div>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="currentPassword">
                Contraseña Actual <span className="text-red-500">*</span>
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="newPassword">
                Nueva Contraseña <span className="text-red-500">*</span>
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="confirmPassword">
                Confirmar Nueva Contraseña <span className="text-red-500">*</span>
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
          </div>
          <div className="bg-gray-50 px-6 py-3 text-right rounded-b-lg">
            <button
              type="submit"
              disabled={loadingPassword}
              style={{ backgroundColor: '#D50565' }}
              className="px-6 py-2 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loadingPassword ? 'Actualizando...' : 'Actualizar Contraseña'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Perfil;
