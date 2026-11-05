import { Container } from "@mui/material";
import ActivityFeed from "../components/activity/ActivityFeed";
import { useSeasonContext } from "../contexts/SeasonContext";

/** The Feed tab. Placeholder: the season's activity events; chat arrives with #265. */
const FeedPage = () => {
  const { seasonId } = useSeasonContext();
  return (
    <Container maxWidth="md" sx={{ pb: 3 }}>
      <ActivityFeed scope="seasons" id={seasonId} title="Feed" defaultOpen />
    </Container>
  );
};

export default FeedPage;
