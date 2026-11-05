import { Box, ButtonBase, InputBase, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { tokens } from "../../theme";
import type { GifProvider, GifResult } from "../../utils/gifProvider";
import SettingsSheet from "../settings/SettingsSheet";

interface Props {
  provider: GifProvider;
  onPick: (gif: GifResult) => void;
  onClose: () => void;
}

const SEARCH_DELAY_MS = 350;

/** Search a GIF provider and send the tapped GIF; blank search shows what's trending. */
const GifPicker = ({ provider, onPick, onClose }: Props) => {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const results = useQuery({
    queryKey: ["gif-search", provider.name, query],
    queryFn: ({ signal }) => provider.search(query, signal),
    staleTime: 60_000,
    retry: 0,
  });

  return (
    <SettingsSheet title="Choose a GIF" onClose={onClose} closeLabel="Close">
      <InputBase
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={`Search ${provider.name}`}
        inputProps={{ "aria-label": `Search ${provider.name}`, maxLength: 100 }}
        sx={{
          minHeight: 44,
          px: 2,
          borderRadius: "12px",
          border: `1px solid ${tokens.inputBorder}`,
          bgcolor: tokens.surface,
        }}
      />
      <Box sx={{ minHeight: 160 }}>
        {results.isLoading && <Typography color="text.secondary">Loading GIFs…</Typography>}
        {results.isError && (
          <Typography color="text.secondary">
            Couldn't load GIFs. Check your connection and try again.
          </Typography>
        )}
        {results.data?.length === 0 && (
          <Typography color="text.secondary">No GIFs found. Try another search.</Typography>
        )}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
          {results.data?.map((gif) => (
            <ButtonBase
              key={gif.id}
              onClick={() => onPick(gif)}
              aria-label={`Send GIF: ${gif.title}`}
              sx={{ borderRadius: "10px", overflow: "hidden", bgcolor: tokens.surfaceRaised }}
            >
              <Box
                component="img"
                src={gif.previewUrl}
                alt=""
                loading="lazy"
                sx={{ width: "100%", height: 110, objectFit: "cover", display: "block" }}
              />
            </ButtonBase>
          ))}
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
        Powered by {provider.name}
      </Typography>
    </SettingsSheet>
  );
};

export default GifPicker;
