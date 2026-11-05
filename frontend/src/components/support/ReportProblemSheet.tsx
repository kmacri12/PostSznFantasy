import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Collapse,
  FormControlLabel,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useApiVersion, useReportProblem } from "../../api/queries";
import { REPORT_PROBLEM_ATTACH_NOTE, REPORT_PROBLEM_LABEL } from "../../content/rules";
import { useOptionalSeasonContext } from "../../contexts/SeasonContext";
import { radii, tokens } from "../../theme";
import { collectDiagnostics, type Diagnostics, describeDiagnostics } from "../../utils/diagnostics";
import { friendlyError } from "../common/friendlyError";
import SettingsSheet from "../settings/SettingsSheet";
import { addImages, attachmentSummary, formatMb, MAX_IMAGES } from "./images";

export const MAX_MESSAGE_CHARS = 5000;

interface Props {
  onClose: () => void;
  onSent: () => void;
}

/** More, Report a problem: a message, optional screenshots and optional diagnostic info. */
const ReportProblemSheet = ({ onClose, onSent }: Props) => {
  const { pathname } = useLocation();
  const seasonContext = useOptionalSeasonContext();
  const apiVersion = useApiVersion().data ?? null;
  const report = useReportProblem();
  const picker = useRef<HTMLInputElement>(null);

  const [message, setMessage] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [showIncluded, setShowIncluded] = useState(false);
  const [preview, setPreview] = useState<Diagnostics | null>(null);

  const collect = (): Diagnostics =>
    collectDiagnostics({
      pathname,
      apiVersion,
      leagueId: seasonContext?.leagueId ?? null,
      seasonId: seasonContext?.seasonId ?? null,
      teamId: seasonContext?.season.myTeamId ?? null,
    });

  const toggleIncluded = () => {
    if (!showIncluded) setPreview(collect());
    setShowIncluded(!showIncluded);
  };

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const result = addImages(images, Array.from(event.target.files ?? []));
    setImages(result.files);
    setProblems(result.problems);
    // The same file can then be picked again after removing it.
    event.target.value = "";
  };

  const remove = (index: number) => {
    setImages(images.filter((_, position) => position !== index));
    setProblems([]);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    report.mutate(
      { message: message.trim(), images, diagnostics: includeDiagnostics ? collect() : null },
      { onSuccess: onSent },
    );
  };

  const failure = report.isError
    ? friendlyError(report.error, "Couldn't send your report. Check your connection and try again.")
    : null;

  return (
    <SettingsSheet title={REPORT_PROBLEM_LABEL} onClose={onClose} closeLabel="Cancel">
      <Box component="form" onSubmit={submit} sx={{ display: "grid", gap: 2 }}>
        <TextField
          autoFocus
          fullWidth
          required
          multiline
          minRows={4}
          label="What went wrong?"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          slotProps={{ htmlInput: { maxLength: MAX_MESSAGE_CHARS } }}
        />

        <Box sx={{ display: "grid", gap: 1 }}>
          <Typography sx={{ fontWeight: 600 }}>Screenshots (optional)</Typography>
          <Typography sx={{ fontSize: 13, color: tokens.textSoft }}>
            {REPORT_PROBLEM_ATTACH_NOTE}
          </Typography>
          <input
            ref={picker}
            type="file"
            accept="image/*"
            multiple
            aria-label="Choose images"
            tabIndex={-1}
            style={{ display: "none" }}
            onChange={pick}
          />
          <Button
            variant="outlined"
            sx={{ minHeight: 44, justifySelf: "start" }}
            disabled={images.length >= MAX_IMAGES}
            onClick={() => picker.current?.click()}
          >
            Add screenshots
          </Button>
          {problems.length > 0 && (
            <Alert severity="warning" role="alert">
              {problems.map((problem) => (
                <div key={problem}>{problem}</div>
              ))}
            </Alert>
          )}
          {images.length > 0 && (
            <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 0.5 }}>
              {images.map((file, index) => (
                <Box
                  component="li"
                  // The same name can be attached twice.
                  // biome-ignore lint/suspicious/noArrayIndexKey: files have no id
                  key={`${index}-${file.name}`}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    pl: 1.5,
                    border: `1px solid ${tokens.border}`,
                    borderRadius: `${radii.button}px`,
                  }}
                >
                  <Typography noWrap sx={{ fontSize: 14, minWidth: 0 }}>
                    {file.name}{" "}
                    <Box component="span" sx={{ color: tokens.muted }}>
                      {formatMb(file.size)}
                    </Box>
                  </Typography>
                  <IconButton
                    aria-label={`Remove ${file.name}`}
                    onClick={() => remove(index)}
                    sx={{ width: 44, height: 44 }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
          <Typography sx={{ fontSize: 13, color: tokens.muted }} aria-live="polite">
            {attachmentSummary(images)}
          </Typography>
        </Box>

        <Box>
          <FormControlLabel
            sx={{ minHeight: 44, ml: 0 }}
            control={
              <Checkbox
                checked={includeDiagnostics}
                onChange={(event) => setIncludeDiagnostics(event.target.checked)}
              />
            }
            label="Include diagnostic info"
          />
          <Button
            aria-expanded={showIncluded}
            endIcon={
              <ExpandMoreIcon
                sx={{ transform: showIncluded ? "rotate(180deg)" : "none", transition: "none" }}
              />
            }
            onClick={toggleIncluded}
            sx={{ minHeight: 44 }}
          >
            What's included
          </Button>
          <Collapse in={showIncluded} unmountOnExit>
            {preview && (
              <Box sx={{ display: "grid", gap: 1, pb: 1 }}>
                <Typography sx={{ fontSize: 13, color: tokens.textSoft }}>
                  {includeDiagnostics
                    ? "This is sent with your message. It has no passwords, sign-in tokens, chat messages or request contents."
                    : "Turned off: none of this is sent."}
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: 13, color: tokens.textSoft }}>
                  {describeDiagnostics(preview).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </Box>
                <Box
                  component="pre"
                  tabIndex={0}
                  aria-label="Diagnostic info as sent"
                  sx={{
                    m: 0,
                    p: 1.5,
                    maxHeight: 200,
                    overflow: "auto",
                    fontSize: 11,
                    bgcolor: tokens.surface,
                    border: `1px solid ${tokens.border}`,
                    borderRadius: `${radii.button}px`,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {JSON.stringify(preview, null, 2)}
                </Box>
              </Box>
            )}
          </Collapse>
        </Box>

        {failure && <Alert severity="error">{failure}</Alert>}
        <Button
          type="submit"
          variant="contained"
          sx={{ minHeight: 44 }}
          disabled={report.isPending || message.trim() === ""}
        >
          {report.isPending ? "Sending…" : "Send"}
        </Button>
      </Box>
    </SettingsSheet>
  );
};

export default ReportProblemSheet;
