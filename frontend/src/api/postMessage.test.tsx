import { type InfiniteData, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { api } from "./client";
import { keys, usePostMessage } from "./queries";
import type { Feed } from "./types";

const emptyFeed: InfiniteData<Feed, string> = {
  pageParams: [""],
  pages: [{ items: [], nextBefore: null, hasNew: false, canPost: true }],
};

const setup = () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(keys.feed(7), emptyFeed);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => usePostMessage(7, { userId: 3, name: "pat" }), { wrapper });
  const items = () =>
    client.getQueryData<InfiniteData<Feed, string>>(keys.feed(7))?.pages[0]?.items;
  return { client, hook, items };
};

describe("usePostMessage", () => {
  it("shows the message in the feed before the server answers", async () => {
    let release: (value: unknown) => void = () => {};
    vi.spyOn(api, "post").mockReturnValue(new Promise((resolve) => (release = resolve)));
    const { hook, items } = setup();
    act(() => hook.result.current.mutate({ body: "hello" }));
    await waitFor(() => expect(items()).toHaveLength(1));
    expect(items()?.[0]).toMatchObject({ type: "message", body: "hello", authorName: "pat" });
    release({ data: {} });
  });

  it("puts the feed back when the server refuses the message", async () => {
    vi.spyOn(api, "post").mockRejectedValue(new Error("nope"));
    const { hook, items } = setup();
    act(() => hook.result.current.mutate({ body: "hello" }));
    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(items()).toEqual([]);
  });
});
