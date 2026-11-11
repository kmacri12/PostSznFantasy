import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountSheet from "./AccountSheet";

const mocks = vi.hoisted(() => ({
  changeEmail: vi.fn(),
  signOutEverywhere: vi.fn(),
  removeDevice: vi.fn(),
  download: vi.fn(),
  account: {
    data: undefined as unknown,
  },
}));

vi.mock("../../contexts/UserContext", () => ({
  useUser: () => ({
    changeEmail: mocks.changeEmail,
    signOutEverywhere: mocks.signOutEverywhere,
  }),
}));
vi.mock("../../api/queries", () => ({
  useAccount: () => ({ data: mocks.account.data, isError: false }),
  useRemoveDevice: () => ({ mutate: mocks.removeDevice, isPending: false, error: null }),
  useSaveDisplayPreferences: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  downloadMyData: mocks.download,
}));

const account = {
  username: "Kyle",
  email: "kyle@example.com",
  signInMethods: ["google", "email"],
  displayTimeZone: null,
  hourCycle: null,
  devices: [
    {
      id: 7,
      label: "Chrome on Android",
      createdAt: "2027-01-01T00:00:00Z",
      lastSeen: "2027-01-05T00:00:00Z",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.account.data = account;
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

describe("AccountSheet", () => {
  it("shows the email, the sign-in methods and each device", () => {
    render(<AccountSheet onClose={vi.fn()} />);
    const sheet = screen.getByRole("dialog", { name: "Account" });
    expect(sheet).toHaveTextContent("kyle@example.com");
    expect(sheet).toHaveTextContent("Google, Emailed code");
    expect(sheet).toHaveTextContent("Chrome on Android");
  });

  it("removes a device by its id", () => {
    render(<AccountSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Chrome on Android" }));
    expect(mocks.removeDevice).toHaveBeenCalledWith(7);
  });

  it("asks for a confirmation link and says where it went", async () => {
    mocks.changeEmail.mockResolvedValue(null);
    render(<AccountSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Email/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "New email" }), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.changeEmail).toHaveBeenCalledWith("new@example.com"));
    expect(await screen.findByText(/confirmation link to new@example.com/)).toBeInTheDocument();
  });

  it("does not accept an address that is not one", () => {
    render(<AccountSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Email/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "New email" }), {
      target: { value: "nope" },
    });
    expect(screen.getByText("Enter a full email address.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("downloads the data", async () => {
    mocks.download.mockResolvedValue(undefined);
    render(<AccountSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Download my data/ }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalled());
  });

  it("signs out everywhere only after the confirmation", async () => {
    mocks.signOutEverywhere.mockResolvedValue(null);
    const onClose = vi.fn();
    render(<AccountSheet onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out everywhere" }));
    expect(mocks.signOutEverywhere).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog", { name: "Sign out everywhere?" });
    fireEvent.click(dialog.querySelector("button.MuiButton-contained") as HTMLElement);
    await waitFor(() => expect(mocks.signOutEverywhere).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
