import { describe, expect, it } from "vitest";
import { decodeImagePayload, ImagePayloadError } from "./imagePayload";

describe("decodeImagePayload", () => {
  it("decodes raw base64 and supported image data URLs", () => {
    const encoded = Buffer.from("parsel").toString("base64");
    expect(Buffer.from(decodeImagePayload(encoded)).toString()).toBe("parsel");
    expect(Buffer.from(decodeImagePayload(`data:image/jpeg;base64,${encoded}`)).toString()).toBe(
      "parsel",
    );
  });

  it.each([undefined, "", "%%%", "data:text/plain;base64,cGFyc2Vs", "abc"])(
    "rejects invalid payload %s",
    (payload) => {
      expect(() => decodeImagePayload(payload)).toThrow(ImagePayloadError);
    },
  );

  it("rejects images over 8 MiB", () => {
    const oversized = Buffer.alloc(8 * 1024 * 1024 + 1).toString("base64");
    try {
      decodeImagePayload(oversized);
      throw new Error("expected decodeImagePayload to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ImagePayloadError);
      expect((error as ImagePayloadError).status).toBe(413);
    }
  });
});
