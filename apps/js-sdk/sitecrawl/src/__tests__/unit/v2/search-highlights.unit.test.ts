import { describe, expect, jest, test } from "@jest/globals";
import { search } from "../../../v2/methods/search";

describe("v2 search highlights", () => {
  test("forwards the highlights option", async () => {
    const http = {
      post: jest.fn(async () => ({ status: 200, data: { success: true } })),
    } as any;

    await search(http, { query: "sitecrawl", highlights: false });

    expect(http.post).toHaveBeenCalledWith(
      "/v2/search",
      { query: "sitecrawl", highlights: false },
      {},
    );
  });
});
