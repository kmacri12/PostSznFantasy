import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AvatarSheet from "./AvatarSheet";

const mocks = vi.hoisted(() => ({ toBlob: vi.fn() }));

const renderSheet = (overrides: { currentUrl?: string | null; failure?: string | null } = {}) => {
  const props = {
    title: "Profile picture",
    name: "Kyle",
    currentUrl: null,
    onSave: vi.fn().mockResolvedValue(undefined),
    onRemove: vi.fn().mockResolvedValue(undefined),
    failure: null,
    onClose: vi.fn(),
    ...overrides,
  };
  render(<AvatarSheet {...props} />);
  return props;
};

const pick = (file: File) =>
  fireEvent.change(screen.getByLabelText("Choose a picture"), { target: { files: [file] } });

beforeEach(() => {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 800, height: 600, close: vi.fn() }),
  );
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    drawImage: vi.fn(),
  })) as never;
  mocks.toBlob.mockImplementation((done: (blob: Blob) => void) =>
    done(new Blob(["jpeg"], { type: "image/jpeg" })),
  );
  HTMLCanvasElement.prototype.toBlob = mocks.toBlob as never;
});

describe("AvatarSheet", () => {
  it("refuses a file that is not an image, and one over 5 MB, with a message", () => {
    renderSheet();
    pick(new File(["x"], "notes.pdf", { type: "application/pdf" }));
    expect(screen.getByRole("alert")).toHaveTextContent("isn't an image");

    const big = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 7.2 * 1024 * 1024 });
    pick(big);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "That image is 7.2 MB. The limit is 5.0 MB.",
    );
  });

  it("crops the chosen image and hands the JPEG to onSave, then closes", async () => {
    const props = renderSheet();
    pick(new File(["x"], "me.png", { type: "image/png" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save picture" }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    const [blob] = props.onSave.mock.calls[0] ?? [];
    expect((blob as Blob).type).toBe("image/jpeg");
  });

  it("says so when the browser cannot read the image", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("decode")));
    renderSheet();
    pick(new File(["x"], "odd.heic", { type: "" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't read that image");
  });

  it("offers to remove the current picture, and the save failure stays visible", async () => {
    const props = renderSheet({
      currentUrl: "/api/avatars/abc",
      failure: "Couldn't save the picture. Try again.",
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save the picture");
    fireEvent.click(screen.getByRole("button", { name: "Remove picture" }));
    await waitFor(() => expect(props.onRemove).toHaveBeenCalled());
  });
});
