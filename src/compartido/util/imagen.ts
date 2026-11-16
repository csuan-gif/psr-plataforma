/** Compresión de fotos en el navegador (ahorra datos con señal débil y espacio en el plan gratuito). */
export async function comprimirImagen(f: File | Blob, ladoMax = 1600, maxMB = 0.6): Promise<Blob> {
  try {
    const { default: comprimir } = await import("browser-image-compression");
    return await comprimir(f as File, { maxWidthOrHeight: ladoMax, maxSizeMB: maxMB, useWebWorker: false, // sin worker: su worker descarga código de un CDN externo (lo bloquearía la CSP)
      initialQuality: 0.8 });
  } catch {
    return f; // si falla la compresión, se usa el original
  }
}

/** Convierte un archivo o una URL en data URL (para meter imágenes en el PDF). */
export async function aDataUrl(origen: Blob | string): Promise<string | null> {
  try {
    const blob = typeof origen === "string" ? await (await fetch(origen)).blob() : origen;
    return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => res(null); r.readAsDataURL(blob); });
  } catch { return null; }
}
