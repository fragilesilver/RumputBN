import { describe, expect, it } from "vitest";
import { formatPhone, normaliseBruneiPhone, whatsappLink } from "./phone";
import { safeNext } from "./redirect";

describe("phone helpers", () => {
  it("normalises the ways people type Brunei numbers", () => {
    expect(normaliseBruneiPhone("712 3456")).toBe("+6737123456");
    expect(normaliseBruneiPhone("+673 712-3456")).toBe("+6737123456");
    expect(normaliseBruneiPhone("6737123456")).toBe("+6737123456");
    expect(normaliseBruneiPhone("71234")).toBeNull();
    expect(normaliseBruneiPhone("+60123456789")).toBeNull();
  });

  it("formats and links", () => {
    expect(formatPhone("6737123456")).toBe("+673 712 3456");
    expect(whatsappLink("+6737123456", "Hi")).toBe("https://wa.me/6737123456?text=Hi");
  });
});

describe("safeNext", () => {
  it("only allows relative same-site paths", () => {
    expect(safeNext("/jobs/1")).toBe("/jobs/1");
    expect(safeNext("https://evil.example")).toBe("/jobs");
    expect(safeNext("//evil.example")).toBe("/jobs");
    expect(safeNext("/\\evil.example")).toBe("/jobs");
    expect(safeNext(undefined, "/")).toBe("/");
  });
});
