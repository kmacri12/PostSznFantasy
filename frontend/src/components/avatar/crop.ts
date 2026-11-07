export const AVATAR_OUTPUT_SIZE = 512;
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
export const MAX_ZOOM = 4;

export interface CropView {
  /** The image's size in px as drawn in the square window at zoom 1 ("cover" the window). */
  zoom: number;
  /** Where the window's center sits in the image, as a fraction of its width and height. */
  centerX: number;
  centerY: number;
}

export interface SourceRect {
  x: number;
  y: number;
  size: number;
}

/** The square of the source image the window shows: the short side at zoom 1, smaller as you zoom in. */
export const sourceRect = (width: number, height: number, view: CropView): SourceRect => {
  const size = Math.min(width, height) / view.zoom;
  const x = Math.min(Math.max(view.centerX * width - size / 2, 0), width - size);
  const y = Math.min(Math.max(view.centerY * height - size / 2, 0), height - size);
  return { x, y, size };
};

/** Moves the view by a drag of (dx, dy) window pixels, keeping the window inside the image. */
export const panView = (
  width: number,
  height: number,
  view: CropView,
  dx: number,
  dy: number,
  windowSize: number,
): CropView => {
  const { size } = sourceRect(width, height, view);
  const perPixel = size / windowSize;
  const rect = sourceRect(width, height, {
    ...view,
    centerX: view.centerX - (dx * perPixel) / width,
    centerY: view.centerY - (dy * perPixel) / height,
  });
  return {
    ...view,
    centerX: (rect.x + rect.size / 2) / width,
    centerY: (rect.y + rect.size / 2) / height,
  };
};

export const imageProblem = (file: File): string | null => {
  if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
    return "That file isn't an image. Choose a photo or screenshot.";
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return `That image is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The limit is 5.0 MB.`;
  }
  return null;
};

/** The cropped square as a 512px JPEG, small enough for the API's 1 MB limit. */
export const cropToBlob = async (image: ImageBitmap, rect: SourceRect): Promise<Blob> => {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  context.drawImage(
    image,
    rect.x,
    rect.y,
    rect.size,
    rect.size,
    0,
    0,
    AVATAR_OUTPUT_SIZE,
    AVATAR_OUTPUT_SIZE,
  );
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.88),
  );
  if (!blob) throw new Error("Could not encode the picture");
  return blob;
};
