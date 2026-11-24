import { avatarSrc } from "../../utils/avatarUrl";
import { PICTURE_ICONS } from "../common/generatedPicture";
import type { ShareCard } from "./shareCards";

/** What a card needs that cannot be drawn synchronously: uploaded pictures and the icons' outlines. */
export interface CardAssets {
  /** Loaded uploaded pictures by their `avatarUrl`. */
  avatars: Map<string, CanvasImageSource>;
  /** SVG path data (24x24) of the generated pictures' icons, by icon index. */
  iconPaths: Map<number, string>;
}

const LOAD_TIMEOUT_MS = 4000;

/** `crossOrigin` keeps the canvas exportable; a picture that fails to load is simply left out. */
const loadImage = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), LOAD_TIMEOUT_MS);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    image.src = src;
  });

const attribute = (tag: string, name: string): number =>
  Number(new RegExp(`\\s${name}="([^"]+)"`).exec(tag)?.[1] ?? Number.NaN);

/** A circle element as path data: two half arcs. */
const circlePath = (tag: string): string | null => {
  const [cx, cy, r] = [attribute(tag, "cx"), attribute(tag, "cy"), attribute(tag, "r")];
  if ([cx, cy, r].some(Number.isNaN)) return null;
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
};

/**
 * An icon's outline as path data, found by rendering it once (MUI keeps the shapes in a closure).
 * Most are `<path>`s; the paw draws its toes as `<circle>`s.
 */
const iconPathData = async (index: number): Promise<string | null> => {
  const Icon = PICTURE_ICONS[index];
  if (!Icon) return null;
  const [{ createElement }, { renderToStaticMarkup }] = await Promise.all([
    import("react"),
    import("react-dom/server"),
  ]);
  const markup = renderToStaticMarkup(createElement(Icon));
  const shapes = [...markup.matchAll(/<(path|circle)\b[^>]*>/g)].flatMap((match) => {
    const tag = match[0];
    const data = match[1] === "path" ? /\sd="([^"]+)"/.exec(tag)?.[1] : circlePath(tag);
    return data ? [data] : [];
  });
  return shapes.length > 0 ? shapes.join(" ") : null;
};

export const loadCardAssets = async (card: ShareCard): Promise<CardAssets> => {
  const assets: CardAssets = { avatars: new Map(), iconPaths: new Map() };
  const teams = (card.highlights ?? []).flatMap((item) => (item.team ? [item.team] : []));
  const urls = new Set<string>();
  const icons = new Set<number>();
  for (const team of teams) {
    const src = team.avatarUrl ? avatarSrc(team.avatarUrl) : undefined;
    if (src) urls.add(src);
    else if (team.picture) icons.add(team.picture.icon);
  }
  await Promise.all([
    ...[...urls].map(async (src) => {
      const image = await loadImage(src);
      if (image) assets.avatars.set(src, image);
    }),
    ...[...icons].map(async (index) => {
      const path = await iconPathData(index);
      if (path) assets.iconPaths.set(index, path);
    }),
  ]);
  return assets;
};
