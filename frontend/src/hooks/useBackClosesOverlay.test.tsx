import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { useBackClosesOverlay } from "./useBackClosesOverlay";

const Sheet = ({ onClose, label }: { onClose: () => void; label: string }) => {
  useBackClosesOverlay(onClose);
  return (
    <div>
      <p>{label}</p>
      <button type="button" onClick={onClose}>
        Close {label}
      </button>
    </div>
  );
};

const Page = () => {
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const { pathname } = useLocation();
  return (
    <div>
      <p>Path {pathname}</p>
      <button type="button" onClick={() => setSheet(true)}>
        Open sheet
      </button>
      {sheet && <Sheet label="sheet" onClose={() => setSheet(false)} />}
      {sheet && (
        <button type="button" onClick={() => setDialog(true)}>
          Open dialog
        </button>
      )}
      {dialog && <Sheet label="dialog" onClose={() => setDialog(false)} />}
    </div>
  );
};

const setup = () => {
  const router = createMemoryRouter(
    [
      { path: "/", element: <div>Home</div> },
      { path: "/page", element: <Page /> },
    ],
    { initialEntries: ["/", "/page"], initialIndex: 1 },
  );
  render(<RouterProvider router={router} />);
  return router;
};

const Bare = () => {
  useBackClosesOverlay(() => {});
  return <p>bare</p>;
};

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

describe("useBackClosesOverlay", () => {
  it("closes the sheet on back and stays on the page", async () => {
    const router = setup();
    fireEvent.click(screen.getByRole("button", { name: "Open sheet" }));
    await settle();
    expect(screen.getByText("sheet")).toBeInTheDocument();
    expect(router.state.historyAction).toBe("PUSH");

    await act(() => router.navigate(-1));
    await settle();
    expect(screen.queryByText("sheet")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/page");
  });

  it("goes back once when the sheet is closed in the UI, so history stays tidy", async () => {
    const router = setup();
    fireEvent.click(screen.getByRole("button", { name: "Open sheet" }));
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Close sheet" }));
    await settle();
    expect(screen.queryByText("sheet")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/page");
    expect(router.state.location.state?.overlayStack ?? []).toEqual([]);
    await act(() => router.navigate(-1));
    await settle();
    expect(router.state.location.pathname).toBe("/");
  });

  it("closes only the top overlay when a dialog sits on a sheet", async () => {
    const router = setup();
    fireEvent.click(screen.getByRole("button", { name: "Open sheet" }));
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));
    await settle();
    expect(screen.getByText("dialog")).toBeInTheDocument();

    await act(() => router.navigate(-1));
    await settle();
    expect(screen.queryByText("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("sheet")).toBeInTheDocument();

    await act(() => router.navigate(-1));
    await settle();
    expect(screen.queryByText("sheet")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/page");
  });

  it("does nothing outside a router", () => {
    render(<Bare />);
    expect(screen.getByText("bare")).toBeInTheDocument();
  });
});
