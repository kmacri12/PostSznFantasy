import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isChunkLoadError, markReloadAttempt, reloadedRecently } from "../../utils/chunkError";
import RouteErrorScreen from "./RouteErrorScreen";

const Broken = () => {
  throw thrown;
};
let thrown: Error;

const renderWith = (error: Error) => {
  thrown = error;
  const router = createMemoryRouter([
    { path: "*", element: <Broken />, errorElement: <RouteErrorScreen /> },
  ]);
  render(<RouterProvider router={router} />);
};

const chunkError = () =>
  new TypeError(
    "Failed to fetch dynamically imported module: https://postsznfantasy.com/assets/TeamPage-x.js",
  );

const reloadSpy = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  reloadSpy.mockReset();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload: reloadSpy },
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("isChunkLoadError", () => {
  it("recognises the browsers' wording and nothing else", () => {
    expect(isChunkLoadError(chunkError())).toBe(true);
    expect(isChunkLoadError(new TypeError("error loading dynamically imported module: x"))).toBe(
      true,
    );
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkLoadError("Failed to fetch dynamically imported module")).toBe(false);
  });
});

describe("reload guard", () => {
  it("remembers a reload for a minute", () => {
    expect(reloadedRecently(1000)).toBe(false);
    markReloadAttempt(1000);
    expect(reloadedRecently(30_000)).toBe(true);
    expect(reloadedRecently(70_000)).toBe(false);
  });
});

describe("RouteErrorScreen", () => {
  it("offers a refresh for a failed page file and reloads only on tap", () => {
    renderWith(chunkError());
    expect(screen.getByText("A new version of PostSzn is available")).toBeInTheDocument();
    expect(reloadSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(reloadedRecently()).toBe(true);
  });

  it("does not offer the same refresh again right after one", () => {
    markReloadAttempt();
    renderWith(chunkError());
    expect(screen.getByText("PostSzn still can't load this page")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("shows a generic screen with a way home for any other error", () => {
    renderWith(new Error("boom"));
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/");
  });
});
