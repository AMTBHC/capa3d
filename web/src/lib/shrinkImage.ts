/** Lado más largo con que se envían las fotos de referencia: sobra para diseñar y sube rápido. */
const MAX_SIDE = 2400;
/** Por debajo de esto la foto se envía tal cual. */
const KEEP_BYTES = 2.5 * 1024 * 1024;

/**
 * Reduce una foto pesada del celular antes de subirla. Si el navegador no puede leerla
 * (HEIC fuera de Safari, PDF) o no gana nada, se envía la original.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (file.size <= KEEP_BYTES || !/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * k);
    canvas.height = Math.round(bmp.height * k);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
