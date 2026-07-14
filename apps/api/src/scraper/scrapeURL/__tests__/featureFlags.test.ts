import { buildFeatureFlags } from "../index";

// buildFeatureFlags reads options.formats/waitFor/proxy/etc and derives the engine feature-flag set.
// Minimal options are enough to exercise the menu -> menuModifiers derivation.
const opts = (formats: any[]) => ({ formats, waitFor: 0 }) as any;

describe("buildFeatureFlags menuModifiers", () => {
  const url = "https://www.ubereats.com/store/x/abc";

  it("adds menuModifiers when the menu format is requested", () => {
    const flags = buildFeatureFlags(url, opts([{ type: "menu" }]), {} as any);
    expect(flags.has("menuModifiers")).toBe(true);
  });

  it("omits menuModifiers when the menu format is not requested", () => {
    const flags = buildFeatureFlags(
      url,
      opts([{ type: "markdown" }]),
      {} as any,
    );
    expect(flags.has("menuModifiers")).toBe(false);
  });
});
