import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MagicLinkForm from "./MagicLinkForm";

const submitEmail = (address: string) => {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: address } });
  fireEvent.click(screen.getByRole("button", { name: /email me a sign-in link/i }));
};

describe("MagicLinkForm", () => {
  it("sends the trimmed address and shows the check-your-email state", async () => {
    const onSend = vi.fn().mockResolvedValue(null);
    render(<MagicLinkForm onSend={onSend} />);
    submitEmail("  pat@x.co ");

    await waitFor(() => expect(screen.getByText(/check your email/i)).toBeInTheDocument());
    expect(onSend).toHaveBeenCalledWith("pat@x.co");
    expect(screen.getByRole("button", { name: /resend in/i })).toBeDisabled();
  });

  it("keeps the form and shows the failure when sending fails", async () => {
    render(<MagicLinkForm onSend={vi.fn().mockResolvedValue("Too many emails sent.")} />);
    submitEmail("pat@x.co");

    expect(await screen.findByText("Too many emails sent.")).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("lets the user go back and use another address", async () => {
    render(<MagicLinkForm onSend={vi.fn().mockResolvedValue(null)} />);
    submitEmail("pat@x.co");
    fireEvent.click(await screen.findByRole("button", { name: /different email/i }));

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });
});
