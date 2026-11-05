import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PushNotifications, PushStatus } from "../../hooks/usePushNotifications";
import { JOINED_LEAGUE_STATE, PROMPT_STORAGE_KEY } from "../../utils/notificationPrompt";
import NotificationOptIn from "./NotificationOptIn";

const mocks = vi.hoisted(() => ({
  userId: 7 as number | null,
  push: {} as PushNotifications,
}));
vi.mock("../../contexts/UserContext", () => ({ useUser: () => ({ userId: mocks.userId }) }));
vi.mock("../../hooks/usePushNotifications", () => ({ usePushNotifications: () => mocks.push }));

const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126.0 Mobile Safari/537.36";

const setStatus = (status: PushStatus, overrides: Partial<PushNotifications> = {}) => {
  mocks.push = {
    status,
    busy: false,
    error: null,
    enable: vi.fn().mockResolvedValue(undefined),
    disable: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
};

let go: (path: string, state?: unknown) => void = () => undefined;
const Navigator = () => {
  const navigate = useNavigate();
  go = (path, state) => navigate(path, { state });
  return null;
};

const visit = (path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Navigator />
      <NotificationOptIn />
    </MemoryRouter>,
  );

const shownCount = (): number => {
  const raw = localStorage.getItem(PROMPT_STORAGE_KEY);
  return raw === null ? 0 : (JSON.parse(raw) as { shown: number }).shown;
};

const prompt = () => screen.queryByRole("dialog", { name: "Get notified when it matters" });

beforeEach(() => {
  localStorage.clear();
  mocks.userId = 7;
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ANDROID_UA);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 11, 1, 12));
  setStatus("off");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("when the prompt shows", () => {
  it("opens for a signed-in member whose notifications are off, and counts it", async () => {
    visit("/");
    expect(
      await screen.findByRole("dialog", { name: "Get notified when it matters" }),
    ).toBeVisible();
    expect(screen.getByText(/Allow when Chrome asks/)).toBeVisible();
    expect(shownCount()).toBe(1);
  });

  it("asks for permission only from the Turn on tap", async () => {
    visit("/");
    await screen.findByRole("button", { name: "Turn on notifications" });
    expect(mocks.push.enable).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Turn on notifications" }));
    expect(mocks.push.enable).toHaveBeenCalledTimes(1);
  });

  it("confirms and never returns once notifications are on", async () => {
    const view = visit("/");
    await screen.findByRole("button", { name: "Turn on notifications" });
    setStatus("on");
    view.rerender(
      <MemoryRouter initialEntries={["/"]}>
        <Navigator />
        <NotificationOptIn />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Notifications are on")).toBeVisible();
    expect(JSON.parse(localStorage.getItem(PROMPT_STORAGE_KEY) ?? "{}")).toMatchObject({
      accepted: true,
    });
  });

  it("shows the iPhone Home Screen steps instead of the button in a normal tab", async () => {
    setStatus("needs-install");
    visit("/");
    expect(await screen.findByText(/Add to Home Screen/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Turn on notifications" })).toBeNull();
    expect(screen.getByRole("button", { name: "Not now" })).toBeVisible();
  });

  it("points to More, Settings, Notifications for changing it later", async () => {
    visit("/");
    expect(await screen.findByText(/More, Settings, Notifications/)).toBeVisible();
  });

  it("shows how to unblock if the browser permission gets blocked from the sheet", async () => {
    const view = visit("/");
    await screen.findByRole("button", { name: "Turn on notifications" });
    setStatus("denied");
    view.rerender(
      <MemoryRouter initialEntries={["/"]}>
        <Navigator />
        <NotificationOptIn />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Site settings, Notifications/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Turn on notifications" })).toBeNull();
  });
});

describe("when it stays away", () => {
  it.each(["on", "denied", "unsupported", "unconfigured"] as const)(
    "nothing for %s, and no prompt is spent",
    async (status) => {
      setStatus(status);
      visit("/");
      await act(async () => undefined);
      expect(prompt()).toBeNull();
      expect(shownCount()).toBe(0);
    },
  );

  it("nothing while signed out", async () => {
    mocks.userId = null;
    visit("/");
    await act(async () => undefined);
    expect(prompt()).toBeNull();
    expect(shownCount()).toBe(0);
  });

  it("never on a draft screen, but right after leaving it", async () => {
    visit("/leagues/3/draft");
    await act(async () => undefined);
    expect(prompt()).toBeNull();
    act(() => go("/leagues/3"));
    expect(
      await screen.findByRole("dialog", { name: "Get notified when it matters" }),
    ).toBeVisible();
  });

  it("not for a visit that starts on create league, nor after it", async () => {
    visit("/create-league");
    await act(async () => undefined);
    act(() => go("/leagues/3"));
    await act(async () => undefined);
    expect(prompt()).toBeNull();
    expect(shownCount()).toBe(0);
  });

  it("waits out an invite page, then shows after joining", async () => {
    visit("/join/ABC");
    await act(async () => undefined);
    expect(prompt()).toBeNull();
    act(() => go("/leagues/3", JOINED_LEAGUE_STATE));
    expect(
      await screen.findByRole("dialog", { name: "Get notified when it matters" }),
    ).toBeVisible();
  });

  it("not when the device cannot remember what it showed", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    visit("/");
    await act(async () => undefined);
    expect(prompt()).toBeNull();
  });
});

describe("the cap of two", () => {
  it("Not now closes it; the same day it does not come back", async () => {
    visit("/");
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    await waitFor(() => expect(prompt()).toBeNull());
    act(() => go("/leagues/3/feed"));
    act(() => go("/leagues/3", JOINED_LEAGUE_STATE));
    await act(async () => undefined);
    expect(prompt()).toBeNull();
    expect(shownCount()).toBe(1);
  });

  it("shows a second time on another day after Not now, and never a third", async () => {
    const closeAndWait = async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
      await waitFor(() => expect(prompt()).toBeNull());
    };

    const first = visit("/");
    await closeAndWait();
    first.unmount();

    vi.setSystemTime(new Date(2026, 11, 2, 12));
    const second = visit("/");
    await closeAndWait();
    second.unmount();
    expect(shownCount()).toBe(2);

    for (let dayOfMonth = 3; dayOfMonth <= 20; dayOfMonth++) {
      vi.setSystemTime(new Date(2026, 11, dayOfMonth, 12));
      const later = visit("/");
      await act(async () => undefined);
      act(() => go("/leagues/3", JOINED_LEAGUE_STATE));
      await act(async () => undefined);
      expect(prompt()).toBeNull();
      later.unmount();
    }
    expect(shownCount()).toBe(2);
  });

  it("closing the sheet any other way counts as Not now", async () => {
    visit("/");
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    await waitFor(() => expect(prompt()).toBeNull());
    expect(shownCount()).toBe(1);
  });
});
