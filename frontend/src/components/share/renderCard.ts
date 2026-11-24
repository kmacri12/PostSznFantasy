import { palettes, type ThemeMode } from "../../theme";
import {
  BOARD_CELL,
  BOARD_HEADER,
  BOARD_MARGIN,
  BOARD_ROUND_COL,
  BOARD_TEAM_COL,
  BOARD_TEAM_ROW,
  CARD_WIDTH,
  cardSize,
  type ShareCard,
} from "./shareCards";

const WORDMARK_FONT = '"Space Grotesk", Inter, system-ui, sans-serif';
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

/** The app's top-left logo: the mark, then "PostSzn" over a tracked "FANTASY". */
const drawBrand = (ctx: Ctx, p: Palette, x: number, y: number, size: number, centerX?: number) => {
  const nameSize = Math.round(size * 0.66);
  ctx.font = `700 ${nameSize}px ${WORDMARK_FONT}`;
  const nameWidth = ctx.measureText("Post").width + ctx.measureText("Szn").width;
  // Centered, the whole lockup (mark, gap, name) is what sits on the middle.
  if (centerX !== undefined) x = centerX - (size + size * 0.3 + nameWidth) / 2;
  ctx.fillStyle = p.accentFill;
  roundRect(ctx, x, y, size, size, size * 0.22);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.strokeStyle = p.accentInk;
  ctx.lineJoin = "round";
  LOGO_PATHS.forEach((d, i) => {
    ctx.lineWidth = i === 4 ? 8 : i % 2 === 0 ? 3 : 5;
    ctx.stroke(new Path2D(d));
  });
  ctx.restore();

  const left = x + size + size * 0.3;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = `700 ${nameSize}px ${WORDMARK_FONT}`;
  const baseline = y + size * 0.52;
  ctx.fillStyle = p.text;
  ctx.fillText("Post", left, baseline);
  const postWidth = ctx.measureText("Post").width;
  ctx.fillStyle = p.accent;
  ctx.fillText("Szn", left + postWidth, baseline);

  const fantasySize = Math.round(nameSize * 0.3);
  ctx.font = `500 ${fantasySize}px ${WORDMARK_FONT}`;
  ctx.fillStyle = p.text;
  const tracking = fantasySize * 0.34;
  const letters = [..."FANTASY"];
  const advances = letters.map((letter) => ctx.measureText(letter).width + tracking);
  // The trailing gap after the Y is not ink, so it is left out when centering.
  const inkWidth = advances.reduce((sum, advance) => sum + advance, 0) - tracking;
  let cursor = left + (nameWidth - inkWidth) / 2;
  letters.forEach((letter, index) => {
    ctx.fillText(letter, cursor, baseline + fantasySize * 1.7);
    cursor += advances[index] ?? 0;
  });
};

const drawHeader = (ctx: Ctx, card: ShareCard, p: Palette): number => {
  drawBrand(ctx, p, PAD, PAD, 76);
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

/** The weekly recap: the league, then a label and one or two lines per highlight. */
const TONE_FILL = {
  gold: "gold",
  accent: "accent",
  green: "green",
  red: "red",
  warning: "warning",
} as const;

/** The weekly recap: brand, round and league centered, then a card per highlight. */
const drawRecap = (ctx: Ctx, card: ShareCard, p: Palette) => {
  const width = CARD_WIDTH - PAD * 2;
  const middle = CARD_WIDTH / 2;
  drawBrand(ctx, p, PAD, PAD, 76, middle);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.fillStyle = p.gold;
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText(card.eyebrow.toUpperCase(), middle, 244);
  ctx.fillStyle = p.text;
  ctx.font = `800 60px ${FONT}`;
  ctx.fillText(truncate(ctx, card.headline, width), middle, 316);
  ctx.textAlign = "left";

  const cardHeight = 96;
  const gap = 12;
  const badge = 64;
  let y = 360;
  for (const item of card.highlights ?? []) {
    const color = p[TONE_FILL[item.tone]];
    ctx.fillStyle = p.surface;
    roundRect(ctx, PAD, y, width, cardHeight, 20);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, PAD, y, 8, cardHeight, 4);
    ctx.fill();
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.arc(PAD + 44 + badge / 2, y + cardHeight / 2, badge / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.text;
    ctx.font = `34px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.emoji, PAD + 44 + badge / 2, y + cardHeight / 2 + 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    const textLeft = PAD + 44 + badge + 24;
    let textRight = PAD + width - 28;
    if (item.stat) {
      ctx.fillStyle = color;
      ctx.font = `800 48px ${FONT}`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(item.stat, textRight, y + cardHeight / 2 + 2);
      textRight -= ctx.measureText(item.stat).width + 28;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
    ctx.fillStyle = color;
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText(item.label.toUpperCase(), textLeft, y + 32);
    ctx.fillStyle = p.text;
    ctx.font = `600 28px ${FONT}`;
    wrap(ctx, item.text, textRight - textLeft, 2).forEach((line, i) => {
      ctx.fillText(line, textLeft, y + 62 + i * 30);
    });
    y += cardHeight + gap;
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

/** Teams as columns, rounds as rows, like the board in the draft room. */
const drawDraft = (ctx: Ctx, card: ShareCard, p: Palette, width: number) => {
  drawBrand(ctx, p, BOARD_MARGIN, 32, 60);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.accent;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(card.eyebrow.toUpperCase(), BOARD_MARGIN, 148);
  ctx.fillStyle = p.textSoft;
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText(
    truncate(ctx, `${card.headline} · ${card.subhead}`, width - BOARD_MARGIN * 2),
    BOARD_MARGIN,
    186,
  );

  const gridLeft = BOARD_MARGIN + BOARD_ROUND_COL;
  const rounds = Math.max(1, ...card.columns.map((column) => column.lines.length));
  const textW = BOARD_TEAM_COL - 16;
  card.columns.forEach((column, index) => {
    const x = gridLeft + index * BOARD_TEAM_COL;
    ctx.fillStyle = p.text;
    ctx.font = `700 22px ${FONT}`;
    wrap(ctx, column.title, textW, 2).forEach((line, i) => {
      ctx.fillText(line, x + 8, BOARD_HEADER + 30 + i * 26);
    });
  });
  for (let round = 0; round < rounds; round++) {
    const y = BOARD_HEADER + BOARD_TEAM_ROW + round * BOARD_CELL;
    ctx.fillStyle = p.muted;
    ctx.font = `700 24px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(String(round + 1), BOARD_MARGIN + BOARD_ROUND_COL / 2, y + BOARD_CELL / 2 + 8);
    ctx.textAlign = "left";
    card.columns.forEach((column, index) => {
      const line = column.lines[round];
      if (!line) return;
      const x = gridLeft + index * BOARD_TEAM_COL;
      const fill = POSITION_FILL[(line.position ?? "").toUpperCase()];
      ctx.fillStyle = fill ? p[fill] : p.surface;
      roundRect(ctx, x + 3, y + 3, BOARD_TEAM_COL - 6, BOARD_CELL - 6, 8);
      ctx.fill();
      ctx.fillStyle = p.text;
      ctx.font = `700 20px ${FONT}`;
      const names = wrap(ctx, line.text, textW, 2);
      names.forEach((name, i) => {
        ctx.fillText(name, x + 10, y + 27 + i * 22);
      });
      if (line.position) {
        ctx.fillStyle = p.textSoft;
        ctx.font = `600 16px ${FONT}`;
        ctx.fillText(line.position, x + 10, y + BOARD_CELL - 12);
      }
    });
  }
};

/** Draws the card on a 1080x1350 canvas in the chosen theme (CSS variables don't reach a canvas). */
export const drawShareCard = (ctx: Ctx, card: ShareCard, mode: ThemeMode): void => {
  const p = palettes[mode];
  const { width, height } = cardSize(card);
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, width, height);
  const margin = card.kind === "draft" ? BOARD_MARGIN : PAD;
  if (card.kind === "draft") drawDraft(ctx, card, p, width);
  else if (card.kind === "recap") drawRecap(ctx, card, p);
  else drawPodium(ctx, card, p);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = p.muted;
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText(
    truncate(ctx, card.leagueName, width - margin * 2 - 280),
    margin,
    height - margin - 10,
  );
  ctx.textAlign = "right";
  ctx.fillText("postsznfantasy.com", width - margin, height - margin - 10);
  ctx.textAlign = "left";
};

export const renderShareCard = (card: ShareCard, mode: ThemeMode): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const { width, height } = cardSize(card);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("canvas unavailable"));
    drawShareCard(ctx, card, mode);
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("render failed"))),
      "image/png",
    );
  });
