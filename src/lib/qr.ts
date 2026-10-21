import qrcode from "qrcode-generator";

// QR Code do link do formulário, como imagem vetorial (sem arquivo e sem serviço de fora).
export function qrSvg(text: string): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
}
