import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAppOutdated, signalAppOutdated } from "../../api/appOutdated";
import { recordFresh, resetFresh } from "../../utils/dataFreshness";

vi.mock("../../utils/appVersion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/appVersion")>()),
  BUILD_TIME: 100,
  fetchDeployedBuild: vi.fn(),
}));

import { fetchDeployedBuild } from "../../utils/appVersion";
import OfflineBanner from "./OfflineBanner";
import UpdateBanner from "./UpdateBanner";

const setOnline = (online: boolean) => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: online });
  act(() => {
    window.dispatchEvent(new Event(online ? "online" : "offline"));
  });
};

beforeEach(() => {
  resetFresh();
  resetAppOutdated();
  vi.mocked(fetchDeployedBuild).mockResolvedValue(null);
});
afterEach(() => setOnline(true));

describe("OfflineBanner", () => {
  it("is hidden while online", () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("names the time of the data and says changes are off", () => {
    recordFresh(new Date(2026, 0, 10, 15, 42).getTime());
    render(<OfflineBanner />);
    setOnline(false);
    expect(screen.getByRole("status")).toHaveTextContent(
      /You're offline\..*Showing data from .*3:42.*Changes are turned off/,
    );
    setOnline(true);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("still explains itself with no data time", () => {
    render(<OfflineBanner />);
    setOnline(false);
    expect(screen.getByRole("status")).toHaveTextContent(
      "You're offline. Changes are turned off until you're back.",
    );
  });
});

describe("UpdateBanner", () => {
  const renderAt = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <UpdateBanner />
      </MemoryRouter>,
    );

  it("offers a refresh when a newer build is deployed", async () => {
    vi.mocked(fetchDeployedBuild).mockResolvedValue(200);
    renderAt("/leagues/1");
    expect(await screen.findByText("Update available, tap to refresh")).toBeVisible();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
  });

  it("stays quiet when the deployed build is the same", async () => {
    vi.mocked(fetchDeployedBuild).mockResolvedValue(100);
    renderAt("/leagues/1");
    await act(async () => {});
    expect(screen.queryByText("Update available, tap to refresh")).not.toBeInTheDocument();
  });

  it("never interrupts a draft", async () => {
    vi.mocked(fetchDeployedBuild).mockResolvedValue(200);
    renderAt("/leagues/1/draft");
    await act(async () => {});
    expect(screen.queryByText("Update available, tap to refresh")).not.toBeInTheDocument();
  });

  it("waits while a field has focus, then appears", async () => {
    vi.mocked(fetchDeployedBuild).mockResolvedValue(200);
    render(
      <MemoryRouter initialEntries={["/leagues/1/feed"]}>
        <input aria-label="Message" />
        <UpdateBanner />
      </MemoryRouter>,
    );
    fireEvent.focusIn(screen.getByLabelText("Message"));
    await act(async () => {});
    expect(screen.queryByText("Update available, tap to refresh")).not.toBeInTheDocument();
    fireEvent.focusOut(screen.getByLabelText("Message"), { relatedTarget: null });
    expect(await screen.findByText("Update available, tap to refresh")).toBeVisible();
  });

  it("asks for a refresh at once when the API refuses this build", () => {
    renderAt("/leagues/1/draft");
    act(() => signalAppOutdated());
    expect(screen.getByText(/Please refresh to keep going/)).toBeVisible();
  });
});
