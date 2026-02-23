import sharp from "sharp";

export async function flipHorizontal(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).flop().png().toBuffer();
}
