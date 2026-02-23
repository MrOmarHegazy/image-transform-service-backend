import { config } from "../config";

export async function removeBackground(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<Buffer> {
  const form = new FormData();
  form.append(
    "image_file",
    new Blob([new Uint8Array(imageBuffer)], { type: mimeType }),
    "image.png",
  );

  const res = await fetch("https://clipdrop-api.co/remove-background/v1", {
    method: "POST",
    headers: { "x-api-key": config.CLIPDROP_API_KEY },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Clipdrop API error (${res.status}): ${text || res.statusText}`,
    );
  }

  return Buffer.from(await res.arrayBuffer());
}
