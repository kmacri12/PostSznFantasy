import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotificationsToggle from "./NotificationsToggle";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  status: { current: "on" as string },
}));

vi.mock("../../api/queries", () => ({
  usePushPreferences: () => ({
    data: { draftAlerts: true, lineupReminders: true, chat: false, mutedLeagueIds: [] },
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
});

describe("NotificationsToggle", () => {
  it("shows the three kinds under the master switch, chat off by default", () => {
    render(<NotificationsToggle />);
    expect(screen.getByRole("switch", { name: "Draft alerts" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Lineup reminders" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Chat messages" })).not.toBeChecked();
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
