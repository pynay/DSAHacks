const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,/i;

export class ImagePayloadError extends Error {
  constructor(message: string, readonly status: 400 | 413 = 400) {
    super(message);
    this.name = "ImagePayloadError";
  }
}

/** Decode an image payload while enforcing the API's accepted formats and size limit. */
export function decodeImagePayload(value: unknown): Uint8Array {
  if (typeof value !== "string" || value.length === 0) {
    throw new ImagePayloadError("image must be a base64 string or image data URL");
  }

  let encoded = value;
  if (value.startsWith("data:")) {
    const match = value.match(IMAGE_DATA_URL_PATTERN);
    if (!match) {
      throw new ImagePayloadError("image data URL must contain JPEG, PNG, or WebP base64 data");
    }
    encoded = value.slice(match[0].length);
  }

  // Reject oversized requests before allocating the decoded buffer.
  if (encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) {
    throw new ImagePayloadError("image exceeds the 8 MiB limit", 413);
  }

  if (!encoded || encoded.length % 4 !== 0) {
    throw new ImagePayloadError("image contains malformed base64 data");
  }

  const buffer = Buffer.from(encoded, "base64");
  // Buffer.from is intentionally permissive, so compare its canonical encoding.
  if (buffer.toString("base64") !== encoded) {
    throw new ImagePayloadError("image contains malformed base64 data");
  }
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) {
    throw new ImagePayloadError("image contains no data");
  }
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new ImagePayloadError("image exceeds the 8 MiB limit", 413);
  }
  return bytes;
}
