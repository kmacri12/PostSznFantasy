import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EmailCodeForm from "./EmailCodeForm";

const submitEmail = (address: string) => {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: address } });
  fireEvent.click(screen.getByRole("button", { name: /email me a sign-in code/i }));
};

const renderForm = (
  onSend = vi.fn().mockResolvedValue(null),
  onVerify = vi.fn().mockResolvedValue(null),
) => {
  render(<EmailCodeForm onSend={onSend} onVerify={onVerify} />);
  return { onSend, onVerify };
};

afterEach(() => vi.useRealTimers());

describe("EmailCodeForm", () => {
  it("shows the address masked, not in full", async () => {
    renderForm();
    submitEmail("pat@x.co");

    expect(await screen.findByText("p**@x.co")).toBeInTheDocument();
    expect(screen.queryByText("pat@x.co")).not.toBeInTheDocument();
  });

  it("counts down, then resends and says a new code is on its way", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { onSend } = renderForm();
    submitEmail("pat@x.co");
    await screen.findByLabelText(/sign-in code/i);
    expect(screen.getByRole("button", { name: "Resend code in 60s" })).toBeDisabled();
    expect(screen.queryByText(/new code is on its way/i)).not.toBeInTheDocument();

    for (let second = 0; second < 60; second++) await act(() => vi.advanceTimersByTimeAsync(1000));
    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));

    expect(await screen.findByText(/new code is on its way/i)).toBeInTheDocument();
    expect(onSend).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Resend code in 60s" })).toBeDisabled();
  });

  it("sends the trimmed address and asks for the code", async () => {
    const { onSend } = renderForm();
    submitEmail("  pat@x.co ");

    const input = await screen.findByLabelText(/sign-in code/i);
    expect(onSend).toHaveBeenCalledWith("pat@x.co");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByRole("button", { name: /resend code in/i })).toBeDisabled();
  });

  it("keeps the email form and shows the failure when sending fails", async () => {
    renderForm(vi.fn().mockResolvedValue("Too many emails sent."));
    submitEmail("pat@x.co");

    expect(await screen.findByText("Too many emails sent.")).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("verifies the digits typed, ignoring other characters", async () => {
    const { onVerify } = renderForm();
    submitEmail("pat@x.co");
    const input = await screen.findByLabelText(/sign-in code/i);
    fireEvent.change(input, { target: { value: "12 34-56" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(onVerify).toHaveBeenCalledWith("pat@x.co", "123456"));
  });

  it("will not submit a code shorter than six digits", async () => {
    renderForm();
    submitEmail("pat@x.co");
    fireEvent.change(await screen.findByLabelText(/sign-in code/i), { target: { value: "123" } });

    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  });

  it("accepts longer codes when the project issues them", async () => {
    const { onVerify } = renderForm();
    submitEmail("pat@x.co");
    fireEvent.change(await screen.findByLabelText(/sign-in code/i), {
      target: { value: "12345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(onVerify).toHaveBeenCalledWith("pat@x.co", "12345678"));
  });

  it("shows a wrong-code error and keeps the code field", async () => {
    renderForm(undefined, vi.fn().mockResolvedValue("That code is wrong or has expired."));
    submitEmail("pat@x.co");
    fireEvent.change(await screen.findByLabelText(/sign-in code/i), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText(/wrong or has expired/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sign-in code/i)).toBeInTheDocument();
  });

  it("lets the user go back and use another address", async () => {
    renderForm();
    submitEmail("pat@x.co");
    fireEvent.click(await screen.findByRole("button", { name: /different email/i }));

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });
});
