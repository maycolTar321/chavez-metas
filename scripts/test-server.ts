import http from "http";

function fetchUrl(url: string): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode || 0, text: data }));
      res.on("error", reject);
    });
  });
}

async function main() {
  console.log("Iniciando prueba de servidor HTTP...");
  try {
    const loginRes = await fetchUrl("http://localhost:3000/login");
    console.log(`GET /login -> Status ${loginRes.status}`);
    console.log("RESPONSE BODY (first 1000 chars):", loginRes.text.slice(0, 1000));
    if (loginRes.text.includes("181.js") || loginRes.text.includes("Cannot find module")) {
      console.error("ERROR DETECTADO EN LA RESPUESTA:", loginRes.text);
      process.exit(1);
    }
    if (loginRes.text.includes("CHÁVEZ METAS")) {
      console.log("✓ CHÁVEZ METAS renderizado correctamente en /login sin errores de chunk ni 181.js");
    }
  } catch (e) {
    console.log("Servidor error:", (e as Error).message);
  }
}

main();
