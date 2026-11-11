import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotificationsToggle from "./NotificationsToggle";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  status: { current: "on" as string },
  quietHours: { current: false },
  zone: { current: "America/Chicago" as string | null },
}));

vi.mock("../../api/queries", () => ({
  usePushPreferences: () => ({
    data: {
      draftAlerts: true,
      lineupReminders: true,
      chat: false,
      mentions: true,
      starterAlerts: true,
      scoreAlerts: false,
      roundResults: false,
      quietHours: mocks.quietHours.current,
      timezone: mocks.zone.current,
      mutedLeagueIds: [],
    },
  }),
  useUpdatePushPreferences: () => ({ mutate: mocks.update, isPending: false, isError: false }),
}));
vi.mock("../../hooks/usePushNotifications", () => ({
  usePushNotifications: () => ({
    status: mocks.status.current,
    busy: false,
    error: null,
    enable: vi.fn(),
    disable: vi.fn(),
  }),
}));

beforeEach(() => {
  mocks.update.mockClear();
  mocks.status.current = "on";
  mocks.quietHours.current = false;
  mocks.zone.current = Intl.DateTimeFormat().resolvedOptions().timeZone;
});

describe("NotificationsToggle", () => {
  it("shows the three kinds under the master switch, chat off by default", () => {
    render(<NotificationsToggle />);
    expect(screen.getByRole("switch", { name: "Draft alerts" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Lineup reminders" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Chat messages" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Mentions" })).toBeChecked();
  });

  it("shows the player alerts: hurt starters on, touchdowns and round results off", () => {
    render(<NotificationsToggle />);
    expect(screen.getByRole("switch", { name: "Hurt starters" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Touchdowns" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Round results" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("switch", { name: "Touchdowns" }));
    expect(mocks.update).toHaveBeenCalledWith({ scoreAlerts: true });
  });

  it("turns quiet hours on together with this browser's time zone", () => {
    render(<NotificationsToggle />);
    expect(screen.getByRole("switch", { name: "Quiet hours" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("switch", { name: "Quiet hours" }));
    expect(mocks.update).toHaveBeenCalledWith({
      quietHours: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  });

  it("keeps the saved zone current while quiet hours are on", () => {
    mocks.quietHours.current = true;
    mocks.zone.current = "Pacific/Auckland";
    render(<NotificationsToggle />);
    expect(mocks.update).toHaveBeenCalledWith({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  });

  it("saves one choice at a time", () => {
    render(<NotificationsToggle />);
    fireEvent.click(screen.getByRole("switch", { name: "Chat messages" }));
    expect(mocks.update).toHaveBeenCalledWith({ chat: true });
  });

  it("hides the kinds while notifications are off on this device", () => {
    mocks.status.current = "off";
    render(<NotificationsToggle />);
    expect(screen.queryByRole("switch", { name: "Draft alerts" })).toBeNull();
  });
});
