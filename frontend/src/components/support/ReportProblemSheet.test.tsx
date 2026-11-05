import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReportProblemSheet from "./ReportProblemSheet";

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("../../api/queries", () => ({
  useReportProblem: () => ({
    mutate: mocks.mutate,
    isPending: false,
    isError: false,
    error: null,
  }),
  useApiVersion: () => ({ data: "abc1234" }),
}));

const MB = 1024 * 1024;

const image = (name: string, bytes: number): File => {
  const file = new File([], name, { type: "image/png" });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
};

const renderSheet = () =>
  render(
    <MemoryRouter initialEntries={["/leagues/3/more"]}>
      <ReportProblemSheet onClose={vi.fn()} onSent={vi.fn()} />
    </MemoryRouter>,
  );

beforeEach(() => mocks.mutate.mockClear());

describe("ReportProblemSheet", () => {
  it("needs a message before it can send", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: /What went wrong/ }), {
      target: { value: "The board is blank" },
    });
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("sends the message with diagnostics by default", () => {
    renderSheet();
    fireEvent.change(screen.getByRole("textbox", { name: /What went wrong/ }), {
      target: { value: "  The board is blank " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    const [report] = mocks.mutate.mock.calls[0] ?? [];
    expect(report.message).toBe("The board is blank");
    expect(report.diagnostics.route).toBe("/leagues/3/more");
  });

  it("sends no diagnostics when the box is unticked", () => {
    renderSheet();
    fireEvent.change(screen.getByRole("textbox", { name: /What went wrong/ }), {
      target: { value: "Broken" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Include diagnostic info" }));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(mocks.mutate.mock.calls[0]?.[0].diagnostics).toBeNull();
  });

  it("shows what is included before anything is sent", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "What's included" }));
    expect(screen.getByLabelText("Diagnostic info as sent").textContent).toContain(
      '"route": "/leagues/3/more"',
    );
  });

  it("shows a running total and refuses an oversize image inline", () => {
    renderSheet();
    const input = screen.getByLabelText("Choose images");
    fireEvent.change(input, {
      target: { files: [image("a.png", 3 * MB), image("big.png", 7.2 * MB)] },
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "That image is 7.2 MB. The limit is 5.0 MB per image.",
    );
    expect(screen.getByText("1 of 5 images, 3.0 MB of 15.0 MB")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove a.png" }));
    expect(screen.getByText("0 of 5 images, 0.0 MB of 15.0 MB")).toBeInTheDocument();
  });
});
