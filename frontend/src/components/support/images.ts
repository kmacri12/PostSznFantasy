export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

// Some phones leave the type empty for HEIC photos.
const HEIC_NAME = /\.(heic|heif)$/i;

export const formatMb = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export const totalBytes = (files: File[]): number =>
  files.reduce((sum, file) => sum + file.size, 0);

export const isImage = (file: File): boolean =>
  file.type.startsWith("image/") || HEIC_NAME.test(file.name);

export const attachmentSummary = (files: File[]): string =>
  `${files.length} of ${MAX_IMAGES} images, ${formatMb(totalBytes(files))} of ${formatMb(MAX_TOTAL_BYTES)}`;

export interface PickResult {
  files: File[];
  /** One message per reason a picked file was left out. */
  problems: string[];
}

/** Adds what fits, in the order picked, and says why anything else was left out. */
export const addImages = (current: File[], picked: File[]): PickResult => {
  const files = [...current];
  const problems: string[] = [];
  for (const file of picked) {
    if (!isImage(file)) {
      problems.push(`"${file.name}" isn't an image. Only screenshots and photos can be attached.`);
    } else if (files.length >= MAX_IMAGES) {
      problems.push(`You can attach up to ${MAX_IMAGES} images.`);
    } else if (file.size > MAX_IMAGE_BYTES) {
      problems.push(
        `That image is ${formatMb(file.size)}. The limit is ${formatMb(MAX_IMAGE_BYTES)} per image.`,
      );
    } else if (totalBytes(files) + file.size > MAX_TOTAL_BYTES) {
      problems.push(
        `Adding that image would make ${formatMb(totalBytes(files) + file.size)}. The limit is ${formatMb(MAX_TOTAL_BYTES)} in total.`,
      );
    } else {
      files.push(file);
    }
  }
  return { files, problems: [...new Set(problems)] };
};
