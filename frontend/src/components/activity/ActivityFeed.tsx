import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, Button, Chip, Collapse, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useActivityFeed, useMarkActivityViewed } from "../../api/queries";
import { tokens } from "../../theme";
import { describeEvent, detailLines, formatWhen } from "./describe";

interface Props {
  scope: "seasons" | "teams";
  id: number;
  title: string;
}

/** The new-activity dot: a shape plus words, so it never relies on colour. */
const NewDot = ({ label }: { label: string }) => (
  <Box
    component="span"
    role="img"
    aria-label={label}
    sx={{
      display: "inline-block",
      width: 10,
      height: 10,
      borderRadius: "50%",
      bgcolor: tokens.gold,
      border: "1px solid #1c1203",
    }}
  />
);

/** One feed, collapsed until opened. Opening it marks everything shown as seen. */
const ActivityFeed = ({ scope, id, title }: Props) => {
  const [open, setOpen] = useState(false);
  // Rows that were new when the feed opened keep their tag until it closes.
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());
  const feed = useActivityFeed(scope, id);
  const markViewed = useMarkActivityViewed(scope, id);
  const events = feed.data?.pages.flatMap((page) => page.events) ?? [];
  const hasNew = feed.data?.pages[0]?.hasNew ?? false;
  const panelId = `activity-${scope}-${id}`;

  // While open, everything shown counts as seen, including rows a refetch adds.
  const newestId = events[0]?.id;
  const newIds = events.filter((event) => event.isNew).map((event) => event.id);
  const newIdsKey = newIds.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the ids, not the arrays
  useEffect(() => {
    if (!open || !hasNew || newestId === undefined) return;
    setFreshIds((seen) => new Set([...seen, ...newIds]));
    markViewed.mutate(newestId);
  }, [open, hasNew, newestId, newIdsKey]);

  const toggle = () => {
    if (open) setFreshIds(new Set());
    setOpen((value) => !value);
  };

  return (
    <Box component="section" aria-label={title} sx={{ mt: 3 }}>
      <Box
        component="button"
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        sx={{
          all: "unset",
          boxSizing: "border-box",
          width: "100%",
          minHeight: 48,
          display: "flex",
          alignItems: "center",
          gap: 1,
          cursor: "pointer",
          "&:focus-visible": { outline: `2px solid ${tokens.gold}`, outlineOffset: 2 },
        }}
      >
        <Typography variant="h6" sx={{ flexGrow: 0 }}>
          {title}
        </Typography>
        {hasNew && !open && (
          <>
            <NewDot label="New activity" />
            <Typography variant="caption" color="text.secondary">
              New
            </Typography>
          </>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <ExpandMoreIcon
          sx={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
        />
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box id={panelId} component="ol" sx={{ m: 0, p: 0, display: "grid", gap: 1 }}>
          {events.length === 0 && (
            <Typography color="text.secondary">
              {feed.isLoading ? "Loading…" : "Nothing has happened yet."}
            </Typography>
          )}
          {events.map((event) => (
            <Box
              component="li"
              key={event.id}
              sx={{
                listStyle: "none",
                p: 1.25,
                border: `1px solid ${event.kind === "commissioner_override" ? tokens.red : tokens.border}`,
                borderRadius: 1,
              }}
            >
              <Typography sx={{ overflowWrap: "anywhere" }}>
                {freshIds.has(event.id) && (
                  <Chip size="small" label="New" color="primary" sx={{ mr: 1 }} />
                )}
                {event.kind === "commissioner_override" && (
                  <Chip size="small" variant="outlined" label="Override" sx={{ mr: 1 }} />
                )}
                {describeEvent(event)}
              </Typography>
              {detailLines(event).map((line) => (
                <Typography key={line} variant="body2" color="text.secondary">
                  {line}
                </Typography>
              ))}
              <Typography variant="caption" color="text.secondary">
                {formatWhen(event.createdAt)}
              </Typography>
            </Box>
          ))}
          {feed.hasNextPage && (
            <Button
              sx={{ minHeight: 44 }}
              disabled={feed.isFetchingNextPage}
              onClick={() => feed.fetchNextPage()}
            >
              Show older
            </Button>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

export default ActivityFeed;
