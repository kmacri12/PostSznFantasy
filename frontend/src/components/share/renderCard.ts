import { palettes, type ThemeMode } from "../../theme";
import { CARD_HEIGHT, CARD_WIDTH, draftGridShape, type ShareCard } from "./shareCards";

const FONT = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const PAD = 72;

// The favicon's marks (viewBox 100), drawn as the logo.
const LOGO_PATHS = [
  "M10 16H23Q27 16 27 20V32Q27 36 23 36H10M10 64H23Q27 64 27 68V80Q27 84 23 84H10",
  "M27 26H36Q40 26 40 30V70Q40 74 36 74H27",
  "M90 16H77Q73 16 73 20V32Q73 36 77 36H90M90 64H77Q73 64 73 68V80Q73 84 77 84H90",
  "M73 26H64Q60 26 60 30V70Q60 74 64 74H73",
  "M40 50H60",
];

type Ctx = CanvasRenderingContext2D;
type Palette = (typeof palettes)[ThemeMode];

const truncate = (ctx: Ctx, text: string, maxWidth: number): string => {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth) end -= 1;
  return `${text.slice(0, end).trimEnd()}…`;
};

/** Longest first line that fits, wrapping on spaces; the last line is cut with an ellipsis. */
const wrap = (ctx: Ctx, text: string, maxWidth: number, maxLines: number): string[] => {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines)
    shown[maxLines - 1] = truncate(ctx, `${shown[maxLines - 1]}…`, maxWidth);
  return shown.map((l) => truncate(ctx, l, maxWidth));
};

const roundRect = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

const drawBrand = (ctx: Ctx, p: Palette) => {
  const size = 64;
  ctx.fillStyle = p.accentFill;
  roundRect(ctx, PAD, PAD, size, size, 14);
  ctx.fill();
  ctx.save();
  ctx.translate(PAD, PAD);
  ctx.scale(size / 100, size / 100);
  ctx.strokeStyle = p.accentInk;
  ctx.lineJoin = "round";
  LOGO_PATHS.forEach((d, i) => {
    ctx.lineWidth = i === 4 ? 8 : i % 2 === 0 ? 3 : 5;
    ctx.stroke(new Path2D(d));
  });
  ctx.restore();
  ctx.fillStyle = p.text;
  ctx.font = `700 34px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText("PostSzn Fantasy", PAD + size + 20, PAD + size / 2);
};

const drawHeader = (ctx: Ctx, card: ShareCard, p: Palette): number => {
  drawBrand(ctx, p);
  const width = CARD_WIDTH - PAD * 2;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = card.kind === "draft" ? p.accent : p.gold;
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText(truncate(ctx, card.eyebrow.toUpperCase(), width), PAD, 240);
  return 240;
};

const drawPodium = (ctx: Ctx, card: ShareCard, p: Palette) => {
  const width = CARD_WIDTH - PAD * 2;
  let y = drawHeader(ctx, card, p) + 40;
  ctx.fillStyle = p.text;
  ctx.font = `800 84px ${FONT}`;
  const lines = wrap(ctx, card.headline, width, 3);
  for (const line of lines) {
    y += 92;
    ctx.fillText(line, PAD, y);
  }
  y += 56;
  ctx.fillStyle = p.textSoft;
  ctx.font = `500 38px ${FONT}`;
  ctx.fillText(truncate(ctx, card.subhead, width), PAD, y);
  y += 70;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillStyle = p.muted;
  ctx.fillText(card.kind === "champion" ? "FINAL STANDINGS" : "ROUND LEADERS", PAD, y);
  y += 24;
  for (const row of card.rows) {
    const h = 132;
    ctx.fillStyle = p.surface;
    roundRect(ctx, PAD, y, width, h, 24);
    ctx.fill();
    ctx.strokeStyle = row.rank === 1 ? p.gold : p.border;
    ctx.lineWidth = 3;
    roundRect(ctx, PAD, y, width, h, 24);
    ctx.stroke();
    ctx.fillStyle = row.rank === 1 ? p.gold : p.muted;
    ctx.font = `800 60px ${FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillText(String(row.rank), PAD + 36, y + h / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = p.text;
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText(row.value, PAD + width - 36, y + h / 2);
    const valueWidth = ctx.measureText(row.value).width;
    ctx.textAlign = "left";
    const textWidth = width - 36 - 90 - 36 - valueWidth - 24;
    ctx.font = `700 42px ${FONT}`;
    ctx.fillText(truncate(ctx, row.label, textWidth), PAD + 110, y + h / 2 - (row.detail ? 22 : 0));
    if (row.detail) {
      ctx.fillStyle = p.textSoft;
      ctx.font = `500 30px ${FONT}`;
      ctx.fillText(truncate(ctx, row.detail, textWidth), PAD + 110, y + h / 2 + 26);
    }
    ctx.textBaseline = "alphabetic";
    y += h + 20;
  }
};

const POSITION_FILL: Record<string, keyof Palette> = {
  QB: "posQB",
  RB: "posRB",
  WR: "posWR",
  TE: "posTE",
  K: "posK",
  DST: "posDST",
  DEF: "posDST",
};

const drawDraft = (ctx: Ctx, card: ShareCard, p: Palette) => {
  const top = drawHeader(ctx, card, p);
  ctx.fillStyle = p.text;
  ctx.font = `800 56px ${FONT}`;
  ctx.fillText(truncate(ctx, card.headline, CARD_WIDTH - PAD * 2), PAD, top + 70);
  ctx.fillStyle = p.textSoft;
  ctx.font = `500 32px ${FONT}`;
  ctx.fillText(card.subhead, PAD, top + 116);

  const { cols, rows } = draftGridShape(card.columns.length);
  const gap = 16;
  const gridTop = top + 150;
  const gridBottom = CARD_HEIGHT - PAD - 44;
  const cellW = (CARD_WIDTH - PAD * 2 - gap * (cols - 1)) / cols;
  const cellH = (gridBottom - gridTop - gap * (rows - 1)) / rows;
  const deepest = Math.max(1, ...card.columns.map((c) => c.lines.length));
  const titleH = Math.min(46, cellH * 0.14);
  const lineH = Math.min(36, (cellH - titleH - 20) / deepest);
  const font = Math.max(14, Math.floor(lineH * 0.7));

  card.columns.forEach((column, index) => {
    const x = PAD + (index % cols) * (cellW + gap);
    const y = gridTop + Math.floor(index / cols) * (cellH + gap);
    ctx.fillStyle = p.surface;
    roundRect(ctx, x, y, cellW, cellH, 18);
    ctx.fill();
    ctx.fillStyle = p.accent;
    ctx.font = `700 ${Math.floor(titleH * 0.6)}px ${FONT}`;
    ctx.fillText(truncate(ctx, column.title, cellW - 24), x + 12, y + titleH * 0.75);
    column.lines.forEach((line, i) => {
      const ly = y + titleH + 8 + i * lineH;
      const fill = POSITION_FILL[(line.position ?? "").toUpperCase()];
      if (fill) {
        ctx.fillStyle = p[fill];
        roundRect(ctx, x + 6, ly, cellW - 12, lineH - 3, 6);
        ctx.fill();
      }
      ctx.fillStyle = p.text;
      ctx.font = `600 ${font}px ${FONT}`;
      ctx.fillText(truncate(ctx, line.text, cellW - 28), x + 14, ly + lineH * 0.68);
    });
  });
};

/** Draws the card on a 1080x1350 canvas in the chosen theme (CSS variables don't reach a canvas). */
export const drawShareCard = (ctx: Ctx, card: ShareCard, mode: ThemeMode): void => {
  const p = palettes[mode];
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  if (card.kind === "draft") drawDraft(ctx, card, p);
  else drawPodium(ctx, card, p);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = p.muted;
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText(
    truncate(ctx, card.leagueName, CARD_WIDTH - PAD * 2 - 280),
    PAD,
    CARD_HEIGHT - PAD + 10,
  );
  ctx.textAlign = "right";
  ctx.fillText("postsznfantasy.com", CARD_WIDTH - PAD, CARD_HEIGHT - PAD + 10);
  ctx.textAlign = "left";
};

export const renderShareCard = (card: ShareCard, mode: ThemeMode): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("canvas unavailable"));
    drawShareCard(ctx, card, mode);
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("render failed"))),
      "image/png",
    );
  });
