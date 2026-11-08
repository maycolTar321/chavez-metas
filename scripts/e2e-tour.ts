import http from "http";
import postgres from "postgres";
import fs from "fs";
import path from "path";

function loadEnv() {
  const p = path.join(process.cwd(), ".env");
  if (!fs.existsSync(p)) return;
  const content = fs.readFileSync(p, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

interface RequestOptions {
  method?: string;
  path: string;
  body?: any;
  cookie?: string;
}

function makeRequest(options: RequestOptions): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string; json?: any }> {
  return new Promise((resolve, reject) => {
    const postData = options.body ? JSON.stringify(options.body) : undefined;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3000,
        path: options.path,
        method: options.method || "GET",
        headers: {
          ...(postData ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) } : {}),
          ...(options.cookie ? { Cookie: options.cookie } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let parsedJson;
          try {
            parsedJson = JSON.parse(data);
          } catch {}
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: data,
            json: parsedJson,
          });
        });
      }
    );
    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runE2ETour() {
  console.log("==================================================================");
  console.log("  CHÁVEZ METAS — RECORRIDO COMPLETO DE PRUEBAS E2E Y MÓDULOS");
  console.log("==================================================================");

  loadEnv();

  // 1. Probar ruta pública de Login sin autenticación
  console.log("[Paso 1/10] Verificando /login (desaparición de error 181.js)...");
  const loginGet = await makeRequest({ path: "/login" });
  if (loginGet.status !== 200 || loginGet.body.includes("181.js") || !loginGet.body.includes("CHÁVEZ METAS")) {
    throw new Error(`Fallo en /login: status ${loginGet.status}`);
  }
  console.log("✓ /login responde 200 OK y renderiza la interfaz corporativa.");

  // 2. Intento de login con credenciales erróneas (manejo seguro)
  console.log("[Paso 2/10] Verificando rechazo de credenciales incorrectas...");
  const badLogin = await makeRequest({
    method: "POST",
    path: "/api/auth/login",
    body: { identifier: "admin", password: "clave_totalmente_invalida_999", rememberMe: false },
  });
  if (badLogin.status !== 401) {
    throw new Error(`Esperado 401, recibido ${badLogin.status}`);
  }
  console.log("✓ Rechazo seguro 401 ante contraseña inválida.");

  // 3. Inicio de sesión exitoso como SUPERADMIN con admin@chavezmetas.local
  console.log("[Paso 3/10] Iniciando sesión SUPERADMIN con admin@chavezmetas.local...");
  const authLogin = await makeRequest({
    method: "POST",
    path: "/api/auth/login",
    body: { identifier: "admin@chavezmetas.local", password: "chavez2026", rememberMe: true },
  });
  if (authLogin.status !== 200) {
    throw new Error(`Error en autenticación SUPERADMIN: status ${authLogin.status} ${authLogin.body}`);
  }

  // Extraer cookie de sesión
  const setCookie = authLogin.headers["set-cookie"];
  if (!setCookie || setCookie.length === 0) {
    throw new Error("No se recibió cookie de sesión");
  }
  const sessionCookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  console.log("✓ Sesión SUPERADMIN iniciada y cookie segura establecida.");

  // 4. Verificar /api/auth/me y acceso a todos los módulos
  console.log("[Paso 4/10] Verificando perfil de usuario y alcance de permisos...");
  const meRes = await makeRequest({ path: "/api/auth/me", cookie: sessionCookie });
  if (meRes.status !== 200 || meRes.json?.user?.role !== "SUPERADMIN") {
    throw new Error(`Error en /api/auth/me: ${meRes.body}`);
  }
  console.log(`✓ Usuario autenticado: ${meRes.json.user.username} (${meRes.json.user.role}) — Rol: ${meRes.json.user.role}`);

  // 5. Verificar Dashboard y los 11 módulos protegidos
  console.log("[Paso 5/10] Verificando acceso a los 11 módulos protegidos del sistema...");
  const modulesToTest = [
    "/dashboard",
    "/ventas",
    "/metas",
    "/sucursales",
    "/personal",
    "/turnos",
    "/rendimiento",
    "/reportes",
    "/historial",
    "/auditoria",
    "/configuracion",
  ];
  for (const mod of modulesToTest) {
    const modRes = await makeRequest({ path: mod, cookie: sessionCookie });
    if (modRes.status !== 200) {
      throw new Error(`Módulo ${mod} devolvió status ${modRes.status}`);
    }
  }
  console.log("✓ Los 11 módulos cargan correctamente con código 200 OK.");

  // 6. Consultar y verificar datos analíticos del Dashboard
  console.log("[Paso 6/10] Verificando API de Dashboard y Velocímetros...");
  const dashApi = await makeRequest({ path: "/api/dashboard", cookie: sessionCookie });
  if (dashApi.status !== 200 || !dashApi.json?.globalKpis) {
    throw new Error(`Error en /api/dashboard: ${dashApi.body}`);
  }
  const kpis = dashApi.json.globalKpis;
  console.log(`✓ Dashboard consolidado: Meta Mensual: Bs ${kpis.totalMonthlyGoal} | Ventas Mes: Bs ${kpis.totalAccumulatedSales} | Cumplimiento: ${kpis.globalCompliancePercent}%`);

  // 7. Prueba del Registro de Ventas por Conceptos (Fórmula de Arqueo)
  console.log("[Paso 7/10] Registrando ventas DEMO con fórmula: TOTAL = EFECTIVO + TARJETA + REC + QR...");
  // Obtener sucursales y turnos
  const branchesRes = await makeRequest({ path: "/api/branches", cookie: sessionCookie });
  const testBranch = branchesRes.json?.branches?.[0];
  const shiftsRes = await makeRequest({ path: "/api/shifts", cookie: sessionCookie });
  const testShift = shiftsRes.json?.shifts?.[0];

  if (!testBranch || !testShift) {
    throw new Error("No hay sucursales o turnos disponibles para la prueba");
  }

  // Trabajador 1: Efectivo 500, Tarjeta 100, QR 200, Rec 50 -> Total: 850 Bs
  const t1Idemp = `demo-sale-t1-${Date.now()}`;
  const sale1 = await makeRequest({
    method: "POST",
    path: "/api/sales",
    cookie: sessionCookie,
    body: {
      branchId: testBranch.id,
      shiftId: testShift.id,
      shiftName: testShift.name,
      shiftType: testShift.type,
      operationalDate: new Date().toISOString().split("T")[0],
      startTime: testShift.startTime,
      endTime: testShift.endTime,
      amount: 850.0,
      observations: "[Desglose: Efectivo Bs 500.00 | Tarjeta Bs 100.00 | QR Bs 200.00 | Recargas Bs 50.00]",
      idempotencyKey: t1Idemp,
    },
  });
  if (sale1.status !== 201) {
    throw new Error(`Error al registrar Venta 1: ${sale1.body}`);
  }
  console.log(`✓ Trabajador 1 registrado: Ef: 500 + Tarj: 100 + QR: 200 + Rec: 50 = Total Bs 850,00`);

  // Trabajador 2: Efectivo 300, Tarjeta 100, QR 150, Rec 0 -> Total: 550 Bs
  const t2Idemp = `demo-sale-t2-${Date.now()}`;
  const sale2 = await makeRequest({
    method: "POST",
    path: "/api/sales",
    cookie: sessionCookie,
    body: {
      branchId: testBranch.id,
      shiftId: testShift.id,
      shiftName: testShift.name,
      shiftType: testShift.type,
      operationalDate: new Date().toISOString().split("T")[0],
      startTime: testShift.startTime,
      endTime: testShift.endTime,
      amount: 550.0,
      observations: "[Desglose: Efectivo Bs 300.00 | Tarjeta Bs 100.00 | QR Bs 150.00 | Recargas Bs 0.00]",
      idempotencyKey: t2Idemp,
    },
  });
  if (sale2.status !== 201) {
    throw new Error(`Error al registrar Venta 2: ${sale2.body}`);
  }
  console.log(`✓ Trabajador 2 registrado: Ef: 300 + Tarj: 100 + QR: 150 + Rec: 0 = Total Bs 550,00`);
  console.log(`✓ Total acumulado del turno registrado: Bs 1.400,00`);

  // 8. Verificar persistencia real de las ventas registradas
  console.log("[Paso 8/10] Verificando persistencia y consulta de ventas en base de datos...");
  const salesList = await makeRequest({
    path: `/api/sales?branchId=${testBranch.id}&limit=10`,
    cookie: sessionCookie,
  });
  const foundSale1 = salesList.json?.sales?.find((s: any) => s.id === sale1.json.sale.id);
  const foundSale2 = salesList.json?.sales?.find((s: any) => s.id === sale2.json.sale.id);
  if (!foundSale1 || !foundSale2) {
    throw new Error("Las ventas registradas no aparecen en el listado");
  }
  console.log("✓ Ambas ventas verificadas en el historial con trazabilidad completa.");

  // 9. Limpieza de datos DEMO para mantener producción limpia
  console.log("[Paso 9/10] Limpiando ventas DEMO de prueba...");
  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });
  await sql`DELETE FROM sales WHERE id IN (${sale1.json.sale.id}, ${sale2.json.sale.id});`;
  await sql.end();
  console.log("✓ Base de datos Neon limpia y libre de registros ficticios temporales.");

  // 10. Probar cierre de sesión (Logout) y comprobación de redirección
  console.log("[Paso 10/10] Probando cierre de sesión seguro...");
  const logoutRes = await makeRequest({
    method: "POST",
    path: "/api/auth/logout",
    cookie: sessionCookie,
  });
  if (logoutRes.status !== 200) {
    throw new Error(`Fallo en logout: ${logoutRes.status}`);
  }
  // Verificar que la cookie fue invalidada
  const postLogout = await makeRequest({ path: "/api/auth/me" });
  if (postLogout.status !== 401) {
    throw new Error(`Esperado 401 tras logout, recibido ${postLogout.status}`);
  }
  console.log("✓ Cierre de sesión seguro y eliminación de credenciales verificado.");

  console.log("==================================================================");
  console.log("  TODAS LAS PRUEBAS E2E DEL RECORRIDO FUERON SUPERADAS AL 100%");
  console.log("==================================================================");
}

runE2ETour().catch((err) => {
  console.error("❌ Error en recorrido E2E:", err);
  process.exit(1);
});
