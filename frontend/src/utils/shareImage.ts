export type ShareImageResult = "shared" | "downloaded" | "cancelled";

const download = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/** The native share sheet with the picture where the browser can share files, else a download. */
export const shareImage = async (
  blob: Blob,
  fileName: string,
  title: string,
): Promise<ShareImageResult> => {
  const file = new File([blob], fileName, { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (error) {
      // Closing the sheet rejects with AbortError; that is not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  download(blob, fileName);
  return "downloaded";
};
