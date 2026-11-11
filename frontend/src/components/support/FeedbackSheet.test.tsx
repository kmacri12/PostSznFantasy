import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FeedbackSheet from "./FeedbackSheet";

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../../api/client", () => ({ api: { post: mocks.post } }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const renderSheet = (onSent = vi.fn()) => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FeedbackSheet onClose={vi.fn()} onSent={onSent} />
    </QueryClientProvider>,
  );
  return onSent;
};

describe("FeedbackSheet", () => {
  beforeEach(() => mocks.post.mockReset().mockResolvedValue({}));

  it("cannot send an empty form", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("sends only what was filled in", async () => {
    const onSent = renderSheet();
    fireEvent.click(screen.getByLabelText("4 out of 5"));
    fireEvent.change(screen.getByRole("textbox", { name: "What was good?" }), {
      target: { value: " The draft " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    expect(mocks.post).toHaveBeenCalledWith("/api/support/feedback", {
      rating: 4,
      good: "The draft",
      bad: "",
    });
  });

  it("sends a text without a rating", async () => {
    renderSheet();
    fireEvent.change(screen.getByRole("textbox", { name: "What was bad?" }), {
      target: { value: "Slow" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalled());
    expect(mocks.post.mock.calls[0]?.[1]).toEqual({ rating: null, good: "", bad: "Slow" });
  });
});
