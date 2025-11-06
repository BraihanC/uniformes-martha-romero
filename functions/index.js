/* eslint-disable max-len, no-undef */
const {
  onCall, // El nuevo método para funciones HTTPS "llamables"
  HttpsError,
} = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");
const sgMail = require("@sendgrid/mail"); // <-- AÑADIDO (para enviar correo)

// Definir el secreto de SendGrid (para Functions v2)
const sendgridApiKey = defineSecret("SENDGRID_API_KEY");

// Inicializar el Admin SDK
initializeApp();

/**
 * Función Auxiliar: Verifica que el usuario que llama sea un Admin.
 * Lee los "custom claims" (roles) del usuario autenticado.
 */
const assertIsAdmin = (context) => {
  if (!context.auth) {
    // 1. Verificar que el usuario esté autenticado
    throw new HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }

  // 2. Verificar que el usuario tenga el rol de 'admin'
  const isAdmin = context.auth.token.role === "admin";
  if (!isAdmin) {
    logger.error("Llamada no autorizada por usuario:", context.auth.uid);
    throw new HttpsError("permission-denied", "Solo los administradores pueden ejecutar esta acción.");
  }

  logger.info("Llamada autorizada por Admin:", context.auth.uid);
  return true;
};

/**
 * [Función 1] - Listar todos los usuarios
 * Devuelve una lista de todos los usuarios de Firebase Authentication.
 */
exports.listUsers = onCall(async (request) => {
  // Verificar permisos de Admin
  assertIsAdmin(request);

  try {
    const userRecords = await getAuth().listUsers(1000); // Max 1000 usuarios

    // Mapear los resultados para enviar solo lo necesario al frontend
    const users = userRecords.users.map((user) => ({
      uid: user.uid,
      email: user.email,
      // Obtener el rol de los 'custom claims'
      role: user.customClaims ? user.customClaims.role : "Sin Rol",
    }));

    return { users };
  } catch (error) {
    logger.error("Error al listar usuarios:", error);
    throw new HttpsError("internal", "Error al listar usuarios.");
  }
});

/**
 * [Función 2] - Crear un nuevo usuario
 * Recibe email, password y rol, y crea un nuevo usuario.
 * Asigna el rol ("admin" o "vendedor") usando "Custom Claims".
 */
exports.createUser = onCall(async (request) => {
  // Verificar permisos de Admin
  assertIsAdmin(request);

  const { email, password, role } = request.data;

  // Validar datos de entrada
  if (!email || !password || !role) {
    throw new HttpsError("invalid-argument", "Email, contraseña y rol son requeridos.");
  }
  if (role !== "admin" && role !== "vendedor") {
    throw new HttpsError("invalid-argument", "El rol debe ser 'admin' o 'vendedor'.");
  }

  try {
    // 1. Crear el usuario en Firebase Authentication
    const userRecord = await getAuth().createUser({
      email: email,
      password: password,
    });

    // 2. Asignar el rol (Custom Claim)
    await getAuth().setCustomUserClaims(userRecord.uid, { role: role });

    logger.info(`Usuario ${userRecord.uid} (${email}) creado con rol: ${role}`);

    // Devolver el nuevo usuario (similar a como lo hace listUsers)
    return {
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        role: role,
      },
    };
  } catch (error) {
    logger.error("Error al crear usuario:", error);
    if (error.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "El email ya está en uso.");
    }
    throw new HttpsError("internal", "Error al crear el usuario.");
  }
});

/**
 * [Función 3] - Borrar un usuario
 * Recibe un 'uid' y elimina al usuario de Firebase Authentication.
 */
exports.deleteUser = onCall(async (request) => {
  // Verificar permisos de Admin
  assertIsAdmin(request);

  const { uid } = request.data;
  if (!uid) {
    throw new HttpsError("invalid-argument", "El UID del usuario es requerido.");
  }

  try {
    // Eliminar el usuario de Auth
    await getAuth().deleteUser(uid);

    logger.info(`Usuario ${uid} eliminado correctamente.`);
    return { success: true, uid: uid };
  } catch (error) {
    logger.error(`Error al eliminar usuario ${uid}:`, error);
    throw new HttpsError("internal", "Error al eliminar el usuario.");
  }
});

/**
 * [Función 4] - Enviar un Recibo de Venta por Correo
 * Lee los datos de una venta y usa SendGrid para enviar un recibo
 */
exports.sendEmailReceipt = onCall(
  { secrets: [sendgridApiKey] },
  async (request) => {
    // 1. Validar datos
    const { saleId, toEmail } = request.data;
    if (!saleId || !toEmail) {
      throw new HttpsError("invalid-argument", "saleId y toEmail son requeridos.");
    }

    // Configurar SendGrid con la API Key desde Secret Manager
    const apiKey = sendgridApiKey.value();

    if (!apiKey) {
      throw new HttpsError("internal", "El servicio de correo no está configurado.");
    }

    logger.info(`API Key configured from Secret Manager`);
    sgMail.setApiKey(apiKey);

    try {
      const db = getFirestore();

      // 2. Obtener los datos de la venta desde Firestore
      const saleDoc = await db.collection("sales").doc(saleId).get();
      if (!saleDoc.exists) {
        throw new HttpsError("not-found", "No se encontró la factura.");
      }
      const saleData = saleDoc.data();

      // 3. Obtener datos de la empresa (logo, nombre, etc.)
      const configDoc = await db.collection("config").doc("company").get();
      const companyData = configDoc.exists ? configDoc.data() : {};
      const fromEmail = "facturacion@em7479.martharomero.co"; // <-- Dominio con Domain Authentication verificado
      const companyName = companyData.nombre || "Uniformes Martha Romero";

      // 4. Construir el HTML del correo (una versión simple de la tirilla)
      const itemsHtml = saleData.items.map((item) => `
        <tr>
          <td style="padding: 5px;">${item.nombre} (x${item.cantidad})</td>
          <td style="padding: 5px; text-align: right;">$${item.subtotal.toLocaleString("es-CO")}</td>
        </tr>
      `).join("");

      // Manejar la fecha de forma segura
      let fechaFactura = "N/A";
      try {
        if (saleData.createdAt && typeof saleData.createdAt.toDate === "function") {
          fechaFactura = new Date(saleData.createdAt.toDate()).toLocaleDateString("es-CO");
        } else if (saleData.createdAt) {
          fechaFactura = new Date(saleData.createdAt).toLocaleDateString("es-CO");
        }
      } catch (e) {
        logger.warn("Error al convertir fecha:", e);
      }

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
          ${companyData.logoUrl ? `<img src="${companyData.logoUrl}" alt="Logo" style="max-width: 300px; display: block; margin: 0 auto 20px;">` : ""}
          <h2 style="text-align: center; color: #D50565;">¡Gracias por tu compra!</h2>
          <p>Hola ${saleData.clienteNombre},</p>
          <p>Adjuntamos el resumen de tu recibo #${saleData.numeroFactura} del ${fechaFactura}.</p>

          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr style="border-bottom: 2px solid #333;">
                <th style="padding: 10px; text-align: left;">Producto</th>
                <th style="padding: 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr style="border-top: 2px solid #333; font-weight: bold;">
                <td style="padding: 10px; text-align: right;">TOTAL PAGADO:</td>
                <td style="padding: 10px; text-align: right;">$${saleData.totalPagado.toLocaleString("es-CO")}</td>
              </tr>
            </tfoot>
          </table>
          <p style="margin-top: 20px; font-size: 12px; color: #777; text-align: center;">
            ${companyName}<br>
            ${companyData.nit || ""}<br>
            ${companyData.direccion || ""}<br>
            ${companyData.telefono || ""}
          </p>

          <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 12px; margin: 15px 0; text-align: center;">
            <p style="margin: 0; font-size: 13px; color: #856404;">
              <strong>Nota importante:</strong> Este documento es un recibo de compra y NO constituye una factura electrónica válida ante la DIAN.
            </p>
          </div>
        </div>
      `;

      // 5. Preparar el objeto de correo
      const msg = {
        to: toEmail,
        from: {
          email: fromEmail,
          name: companyName, // Nombre que ve el cliente
        },
        subject: `Tu Recibo de Compra - Uniformes Martha Romero (N° ${saleData.numeroFactura})`,
        html: emailHtml,
      };

      // 6. Enviar el correo
      await sgMail.send(msg);

      logger.info(`Correo de recibo ${saleId} enviado a ${toEmail}`);
      return { success: true, message: "Correo enviado exitosamente." };
    } catch (error) {
      logger.error(`Error al enviar correo para ${saleId}:`, error);

      // Proporcionar mensajes de error más específicos
      let errorMessage = error.message || "Error desconocido";
      if (error.code === 403) {
        errorMessage = "El email remitente no está verificado en SendGrid. Por favor verifica facturacion@martharomero.co";
      } else if (error.response && error.response.body) {
        errorMessage = JSON.stringify(error.response.body);
      }

      throw new HttpsError("internal", `Error al enviar el correo: ${errorMessage}`);
    }
  },
);

/**
 * [Función 5] - Enviar un Recibo de Pedido por Correo
 */
exports.sendPedidoEmail = onCall(
  { secrets: [sendgridApiKey] },
  async (request) => {
    const { pedidoId, toEmail } = request.data;
    if (!pedidoId || !toEmail) {
      throw new HttpsError("invalid-argument", "pedidoId y toEmail son requeridos.");
    }

    const apiKey = sendgridApiKey.value();
    if (!apiKey) {
      throw new HttpsError("internal", "El servicio de correo no está configurado.");
    }

    sgMail.setApiKey(apiKey);

    try {
      const db = getFirestore();

      // Obtener los datos del pedido
      const pedidoDoc = await db.collection("pedidos").doc(pedidoId).get();
      if (!pedidoDoc.exists) {
        throw new HttpsError("not-found", "No se encontró el pedido.");
      }
      const pedidoData = pedidoDoc.data();

      // Obtener datos de la empresa
      const configDoc = await db.collection("config").doc("company").get();
      const companyData = configDoc.exists ? configDoc.data() : {};
      const fromEmail = "facturacion@em7479.martharomero.co";
      const companyName = companyData.nombre || "Uniformes Martha Romero";

      // Manejar la fecha
      let fechaPedido = "N/A";
      try {
        if (pedidoData.createdAt && typeof pedidoData.createdAt.toDate === "function") {
          fechaPedido = new Date(pedidoData.createdAt.toDate()).toLocaleDateString("es-CO");
        } else if (pedidoData.createdAt) {
          fechaPedido = new Date(pedidoData.createdAt).toLocaleDateString("es-CO");
        }
      } catch (e) {
        logger.warn("Error al convertir fecha:", e);
      }

      // Construir HTML del correo
      const itemsHtml = pedidoData.items.map((item) => `
        <tr>
          <td style="padding: 5px;">
            ${item.nombre} (x${item.cantidad})
            <br><small style="color: #666;">Talla: ${item.talla || "N/A"}</small>
          </td>
          <td style="padding: 5px; text-align: right;">$${item.subtotal.toLocaleString("es-CO")}</td>
        </tr>
      `).join("");

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
          ${companyData.logoUrl ? `<img src="${companyData.logoUrl}" alt="Logo" style="max-width: 300px; display: block; margin: 0 auto 20px;">` : ""}
          <h2 style="text-align: center; color: #D50565;">¡Gracias por tu pedido!</h2>
          <p>Hola ${pedidoData.clienteNombre},</p>
          <p>Adjuntamos el resumen de tu pedido #${pedidoData.numeroPedido} del ${fechaPedido}.</p>

          <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 12px; margin: 15px 0; text-align: center;">
            <p style="margin: 0; font-size: 13px; color: #856404;">
              <strong>Nota importante:</strong> Este es un comprobante de pedido para producción.
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr style="border-bottom: 2px solid #333;">
                <th style="padding: 10px; text-align: left;">Producto</th>
                <th style="padding: 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr style="border-top: 1px solid #ccc;">
                <td style="padding: 10px; text-align: right; font-weight: bold;">TOTAL:</td>
                <td style="padding: 10px; text-align: right; font-weight: bold;">$${pedidoData.total.toLocaleString("es-CO")}</td>
              </tr>
              <tr>
                <td style="padding: 10px; text-align: right;">Abonado:</td>
                <td style="padding: 10px; text-align: right; color: #16a34a;">$${pedidoData.totalAbonado.toLocaleString("es-CO")}</td>
              </tr>
              <tr style="border-top: 2px solid #333; font-weight: bold;">
                <td style="padding: 10px; text-align: right; color: #dc2626;">SALDO PENDIENTE:</td>
                <td style="padding: 10px; text-align: right; color: #dc2626;">$${pedidoData.saldoPendiente.toLocaleString("es-CO")}</td>
              </tr>
            </tfoot>
          </table>

          ${pedidoData.observaciones ? `
            <div style="margin-top: 20px; padding: 10px; background: #f9f9f9; border-left: 4px solid #D50565;">
              <strong>Observaciones:</strong><br>
              ${pedidoData.observaciones}
            </div>
          ` : ""}

          <p style="margin-top: 20px; font-size: 12px; color: #777; text-align: center;">
            ${companyName}<br>
            ${companyData.nit || ""}<br>
            ${companyData.direccion || ""}<br>
            ${companyData.telefono || ""}
          </p>
        </div>
      `;

      const msg = {
        to: toEmail,
        from: {
          email: fromEmail,
          name: companyName,
        },
        subject: `Tu Pedido - Uniformes Martha Romero (N° ${pedidoData.numeroPedido})`,
        html: emailHtml,
      };

      await sgMail.send(msg);
      logger.info(`Correo de pedido ${pedidoId} enviado a ${toEmail}`);
      return { success: true, message: "Correo enviado exitosamente." };
    } catch (error) {
      logger.error(`Error al enviar correo para pedido ${pedidoId}:`, error);
      let errorMessage = error.message || "Error desconocido";
      if (error.code === 403) {
        errorMessage = "El email remitente no está verificado en SendGrid.";
      } else if (error.response && error.response.body) {
        errorMessage = JSON.stringify(error.response.body);
      }
      throw new HttpsError("internal", `Error al enviar el correo: ${errorMessage}`);
    }
  },
);

/**
 * [Función 6] - Enviar un Recibo de Apartado por Correo
 */
exports.sendApartadoEmail = onCall(
  { secrets: [sendgridApiKey] },
  async (request) => {
    const { apartadoId, toEmail } = request.data;
    if (!apartadoId || !toEmail) {
      throw new HttpsError("invalid-argument", "apartadoId y toEmail son requeridos.");
    }

    const apiKey = sendgridApiKey.value();
    if (!apiKey) {
      throw new HttpsError("internal", "El servicio de correo no está configurado.");
    }

    sgMail.setApiKey(apiKey);

    try {
      const db = getFirestore();

      // Obtener los datos del apartado
      const apartadoDoc = await db.collection("apartados").doc(apartadoId).get();
      if (!apartadoDoc.exists) {
        throw new HttpsError("not-found", "No se encontró el apartado.");
      }
      const apartadoData = apartadoDoc.data();

      // Obtener datos de la empresa
      const configDoc = await db.collection("config").doc("company").get();
      const companyData = configDoc.exists ? configDoc.data() : {};
      const fromEmail = "facturacion@em7479.martharomero.co";
      const companyName = companyData.nombre || "Uniformes Martha Romero";

      // Manejar la fecha
      let fechaApartado = "N/A";
      try {
        if (apartadoData.createdAt && typeof apartadoData.createdAt.toDate === "function") {
          fechaApartado = new Date(apartadoData.createdAt.toDate()).toLocaleDateString("es-CO");
        } else if (apartadoData.createdAt) {
          fechaApartado = new Date(apartadoData.createdAt).toLocaleDateString("es-CO");
        }
      } catch (e) {
        logger.warn("Error al convertir fecha:", e);
      }

      // Fecha de vencimiento
      let fechaVencimiento = "N/A";
      try {
        if (apartadoData.fechaLimite && typeof apartadoData.fechaLimite.toDate === "function") {
          fechaVencimiento = new Date(apartadoData.fechaLimite.toDate()).toLocaleDateString("es-CO");
        } else if (apartadoData.fechaLimite) {
          fechaVencimiento = new Date(apartadoData.fechaLimite).toLocaleDateString("es-CO");
        }
      } catch (e) {
        logger.warn("Error al convertir fecha de vencimiento:", e);
      }

      // Construir HTML del correo
      const itemsHtml = apartadoData.items.map((item) => `
        <tr>
          <td style="padding: 5px;">
            ${item.nombre} (x${item.cantidad})
            <br><small style="color: #666;">Talla: ${item.talla || "N/A"}</small>
          </td>
          <td style="padding: 5px; text-align: right;">$${item.subtotal.toLocaleString("es-CO")}</td>
        </tr>
      `).join("");

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
          ${companyData.logoUrl ? `<img src="${companyData.logoUrl}" alt="Logo" style="max-width: 300px; display: block; margin: 0 auto 20px;">` : ""}
          <h2 style="text-align: center; color: #D50565;">¡Gracias por apartar con nosotros!</h2>
          <p>Hola ${apartadoData.clienteNombre},</p>
          <p>Adjuntamos el resumen de tu apartado del ${fechaApartado}.</p>

          <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 12px; margin: 15px 0; text-align: center;">
            <p style="margin: 0; font-size: 13px; color: #856404;">
              <strong>Fecha de vencimiento:</strong> ${fechaVencimiento}<br>
              <strong>Estado:</strong> ${apartadoData.estadoGeneral}
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr style="border-bottom: 2px solid #333;">
                <th style="padding: 10px; text-align: left;">Producto</th>
                <th style="padding: 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr style="border-top: 1px solid #ccc;">
                <td style="padding: 10px; text-align: right; font-weight: bold;">TOTAL APARTADO:</td>
                <td style="padding: 10px; text-align: right; font-weight: bold;">$${apartadoData.totalApartado.toLocaleString("es-CO")}</td>
              </tr>
              <tr>
                <td style="padding: 10px; text-align: right;">Total Abonado:</td>
                <td style="padding: 10px; text-align: right; color: #16a34a;">$${apartadoData.totalAbonado.toLocaleString("es-CO")}</td>
              </tr>
              <tr style="border-top: 2px solid #333; font-weight: bold;">
                <td style="padding: 10px; text-align: right; color: #dc2626;">SALDO PENDIENTE:</td>
                <td style="padding: 10px; text-align: right; color: #dc2626;">$${apartadoData.saldoPendiente.toLocaleString("es-CO")}</td>
              </tr>
            </tfoot>
          </table>

          ${apartadoData.notas ? `
            <div style="margin-top: 20px; padding: 10px; background: #f9f9f9; border-left: 4px solid #D50565;">
              <strong>Notas:</strong><br>
              ${apartadoData.notas}
            </div>
          ` : ""}

          <p style="margin-top: 20px; font-size: 12px; color: #777; text-align: center;">
            ${companyName}<br>
            ${companyData.nit || ""}<br>
            ${companyData.direccion || ""}<br>
            ${companyData.telefono || ""}
          </p>
        </div>
      `;

      const msg = {
        to: toEmail,
        from: {
          email: fromEmail,
          name: companyName,
        },
        subject: `Tu Apartado - Uniformes Martha Romero`,
        html: emailHtml,
      };

      await sgMail.send(msg);
      logger.info(`Correo de apartado ${apartadoId} enviado a ${toEmail}`);
      return { success: true, message: "Correo enviado exitosamente." };
    } catch (error) {
      logger.error(`Error al enviar correo para apartado ${apartadoId}:`, error);
      let errorMessage = error.message || "Error desconocido";
      if (error.code === 403) {
        errorMessage = "El email remitente no está verificado en SendGrid.";
      } else if (error.response && error.response.body) {
        errorMessage = JSON.stringify(error.response.body);
      }
      throw new HttpsError("internal", `Error al enviar el correo: ${errorMessage}`);
    }
  },
);
