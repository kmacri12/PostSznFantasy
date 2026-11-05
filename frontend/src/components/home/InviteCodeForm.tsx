import { Box, Button, TextField } from "@mui/material";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

/** Accepts the code an invite link carries (case-insensitive) and opens /join/:code. */
const InviteCodeForm = () => {
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
        fullWidth
        placeholder="Invite code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        slotProps={{ htmlInput: { maxLength: 16, "aria-label": "Invite code" } }}
      />
      <Button
        type="submit"
        variant="outlined"
        color="primary"
        disabled={!code.trim()}
        sx={{ flexShrink: 0, minWidth: 80 }}
      >
        Join
      </Button>
    </Box>
  );
};

export default InviteCodeForm;
