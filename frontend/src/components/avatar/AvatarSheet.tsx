import { Alert, Box, Button, Slider, Typography } from "@mui/material";
import { type ChangeEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { radii, tokens } from "../../theme";
import PictureAvatar from "../common/PictureAvatar";
import SettingsSheet from "../settings/SettingsSheet";
import { type CropView, cropToBlob, imageProblem, MAX_ZOOM, panView, sourceRect } from "./crop";

const WINDOW_SIZE = 240;

interface Props {
  title: string;
  /** What the initials come from. */
  name: string;
  currentUrl: string | null | undefined;
  fallback?: "initials" | "tile";
  onSave: (picture: Blob) => Promise<void>;
  onRemove: () => Promise<void>;
  /** The message to show when the last save or removal failed. */
  failure: string | null;
  onClose: () => void;
}

const FRESH_VIEW: CropView = { zoom: 1, centerX: 0.5, centerY: 0.5 };

/** Choose a picture, drag and zoom it inside a circle, and save the square. Also removes the current one. */
const AvatarSheet = ({
  title,
  name,
  currentUrl,
  fallback = "initials",
  onSave,
  onRemove,
  failure,
  onClose,
}: Props) => {
  const picker = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [view, setView] = useState<CropView>(FRESH_VIEW);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!image || !context) return;
    const rect = sourceRect(image.width, image.height, view);
    context.clearRect(0, 0, WINDOW_SIZE, WINDOW_SIZE);
    context.drawImage(image, rect.x, rect.y, rect.size, rect.size, 0, 0, WINDOW_SIZE, WINDOW_SIZE);
  }, [image, view]);

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const refusal = imageProblem(file);
    if (refusal) {
      setProblem(refusal);
      return;
    }
    try {
      setImage(await createImageBitmap(file));
      setView(FRESH_VIEW);
      setProblem(null);
    } catch {
      setProblem("We couldn't read that image. Try a JPEG or PNG.");
    }
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      onClose();
    } catch {
      // The caller's mutation error arrives through `failure`.
    } finally {
      setBusy(false);
    }
  };

  const startDrag = (event: PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY };
  };
  const moveDrag = (event: PointerEvent) => {
    if (!drag.current || !image) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    drag.current = { x: event.clientX, y: event.clientY };
    setView((current) => panView(image.width, image.height, current, dx, dy, WINDOW_SIZE));
  };

  return (
    <SettingsSheet title={title} onClose={onClose} closeLabel="Cancel">
      <input
        ref={picker}
        type="file"
        accept="image/*"
        aria-label="Choose a picture"
        tabIndex={-1}
        style={{ display: "none" }}
        onChange={(event) => void choose(event)}
      />
      <Box sx={{ display: "grid", gap: 2, justifyItems: "center" }}>
        {image ? (
          <>
            <Box
              sx={{
                width: WINDOW_SIZE,
                height: WINDOW_SIZE,
                borderRadius: "50%",
                overflow: "hidden",
                border: `2px solid ${tokens.accent}`,
                touchAction: "none",
                cursor: "grab",
              }}
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
            >
              <canvas
                ref={canvas}
                width={WINDOW_SIZE}
                height={WINDOW_SIZE}
                role="img"
                aria-label="Preview of the cropped picture"
                style={{ display: "block" }}
              />
            </Box>
            <Typography sx={{ fontSize: 13, color: tokens.muted }}>
              Drag to move, use the slider to zoom.
            </Typography>
            <Slider
              aria-label="Zoom"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={view.zoom}
              onChange={(_, zoom) =>
                setView((current) => {
                  const next = { ...current, zoom: zoom as number };
                  const rect = sourceRect(image.width, image.height, next);
                  return {
                    ...next,
                    centerX: (rect.x + rect.size / 2) / image.width,
                    centerY: (rect.y + rect.size / 2) / image.height,
                  };
                })
              }
              sx={{ width: WINDOW_SIZE, mx: 1 }}
            />
          </>
        ) : (
          <PictureAvatar url={currentUrl} name={name} size={96} fallback={fallback} />
        )}
        {(problem || failure) && (
          <Alert severity="error" role="alert" sx={{ width: "100%" }}>
            {problem ?? failure}
          </Alert>
        )}
        <Box sx={{ display: "grid", gap: 1, width: "100%" }}>
          {image && (
            <Button
              variant="contained"
              disabled={busy}
              sx={{ minHeight: 44, borderRadius: `${radii.button}px` }}
              onClick={() =>
                void run(async () =>
                  onSave(await cropToBlob(image, sourceRect(image.width, image.height, view))),
                )
              }
            >
              {busy ? "Saving…" : "Save picture"}
            </Button>
          )}
          <Button
            variant={image ? "outlined" : "contained"}
            disabled={busy}
            sx={{ minHeight: 44 }}
            onClick={() => picker.current?.click()}
          >
            {image ? "Choose a different picture" : "Choose a picture"}
          </Button>
          {currentUrl && !image && (
            <Button
              color="error"
              disabled={busy}
              sx={{ minHeight: 44 }}
              onClick={() => void run(onRemove)}
            >
              Remove picture
            </Button>
          )}
        </Box>
      </Box>
    </SettingsSheet>
  );
};

export default AvatarSheet;
