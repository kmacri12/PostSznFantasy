import { Avatar, Box, Card, Typography } from "@mui/material";
import type { InvitePreview } from "../../api/types";

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

const Row = ({ children }: { children: React.ReactNode }) => (
  <Box
    component="li"
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1.5,
      px: 2,
      py: 1.25,
      borderTop: 1,
      borderColor: "divider",
    }}
  >
    {children}
  </Box>
);

/** Every current member, then one dashed row per open slot. Names only, never emails. */
const InviteMembers = ({ preview }: { preview: InvitePreview }) => {
  const total = preview.members.length + preview.openSpots;
  return (
    <Card>
      <Box sx={{ display: "flex", justifyContent: "space-between", px: 2, py: 1.25 }}>
        <Typography variant="caption" color="text.secondary">
          Members
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {preview.members.length} of {total} teams filled
        </Typography>
      </Box>
      <Box component="ul" aria-label="Members" sx={{ listStyle: "none", m: 0, p: 0 }}>
        {preview.members.map((member, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: display names are not unique
          <Row key={index}>
            <Avatar sx={{ width: 32, height: 32, fontSize: 12 }}>
              {initials(member.displayName)}
            </Avatar>
            <Typography sx={{ flex: 1, fontWeight: 600 }}>{member.displayName}</Typography>
            {member.isCommissioner && (
              <Typography variant="caption" color="text.secondary">
                Commissioner
              </Typography>
            )}
          </Row>
        ))}
        {Array.from({ length: preview.openSpots }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholder rows
          <Row key={`open-${index}`}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: "transparent",
                border: "1px dashed",
                borderColor: "text.disabled",
              }}
            >
              {" "}
            </Avatar>
            <Typography color="text.secondary" sx={{ fontWeight: 600 }}>
              Open slot
            </Typography>
          </Row>
        ))}
      </Box>
    </Card>
  );
};

export default InviteMembers;
