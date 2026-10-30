import { Box, Button, TextField } from "@mui/material";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

/** Accepts the same code the invite link carries (case-insensitive) and opens /join/:code. */
const JoinCodeBox = () => {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cleaned = code.trim().toUpperCase();
    if (cleaned) navigate(`/join/${encodeURIComponent(cleaned)}`);
  };

  return (
    <Box component="form" onSubmit={submit} sx={{ display: "flex", gap: 1 }}>
      <TextField
        size="small"
        label="Join code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        slotProps={{ htmlInput: { maxLength: 16, "aria-label": "Join code" } }}
      />
      <Button type="submit" variant="outlined" color="inherit" disabled={!code.trim()}>
        Join with code
      </Button>
    </Box>
  );
};

export default JoinCodeBox;
