import { useEffect, useState } from "react";
import { Boton, Tarjeta } from "../../compartido/ui/base";
import { TALLER } from "../../compartido/config";

/** Cartel imprimible con el código QR del portal (para pegar en el taller o enviar como imagen). */
export default function CartelQR() {
  const [url, setUrl] = useState(`${location.origin}/?origen=qr`);
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let vivo = true;
    import("qrcode").then((q) => q.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } }))
      .then((s) => vivo && setSvg(s)).catch(() => setSvg(""));
    return () => { vivo = false; };
  }, [url]);

  return (
    <div className="grid gap-4">
      <Tarjeta className="print:hidden">
        <h2 className="mb-1 text-lg font-bold">Cartel con código QR</h2>
        <p className="mb-2 text-sm text-suave">Imprímelo y pégalo en la recepción, o envíalo como imagen en el mensaje de bienvenida de WhatsApp Business. Al escanearlo, el cliente abre el portal en su celular.</p>
        <label className="text-sm font-bold">Dirección del portal
          <input className="campo mt-1" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <p className="mt-1 text-xs text-suave">Usa la dirección pública donde publicaste la app (no «localhost»).</p>
        <Boton className="mt-3" onClick={() => window.print()}>🖨 Imprimir cartel</Boton>
      </Tarjeta>
      <section id="cartel-qr" aria-label="Vista previa del cartel" className="mx-auto w-full max-w-md rounded-3xl border-4 border-[#b3121f] bg-white p-6 text-center text-black">
        <img src="/icono.svg" alt="" width={72} height={72} className="mx-auto" />
        <h2 className="mt-2 text-3xl font-bold">{TALLER.nombre}</h2>
        <p className="mt-1 text-xl">¿Qué necesita tu vehículo?</p>
        <div className="mx-auto my-4 w-64" aria-label={`Código QR que abre ${url}`} role="img" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="text-lg font-bold">Escanea con la cámara de tu celular</p>
        <ul className="mx-auto mt-2 max-w-xs text-left">
          <li>✔ Pide tu cita según los cupos del día</li>
          <li>✔ Cuéntanos la falla con fotos o video</li>
          <li>✔ Mira en qué va tu carro sin llamar</li>
        </ul>
        <p className="mt-3 text-sm">WhatsApp {TALLER.telefono} · {TALLER.direccion}</p>
      </section>
    </div>
  );
}
