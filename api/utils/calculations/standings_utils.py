import json
from api.utils.calculations.fantasy_points_utils import calculate_player_points
from api.utils.db.models import db, Lineup, PlayerScore, Team, GameStats, LeagueSettings, NFLPlayer, NFLTeam, PlayerLineup

def get_players_left(team_id, league_id):
    # Fetch the team
    team = Team.query.filter_by(id=team_id, league_id=league_id).first()
    if not team:
        raise ValueError(f"Team with ID {team_id} not found in league {league_id}")

    # Fetch all players on the team
    players = NFLPlayer.query.filter_by(team_id=team_id).all()
    
    # Fetch the status of NFL teams
    nfl_teams = NFLTeam.query.all()  # Assuming you have a field indicating whether the team is active or not
    nfl_team_status = {nfl_team.id: nfl_team.is_active for nfl_team in nfl_teams}  # Example field is_active
    
    # Count players whose NFL team is still active
    players_left_count = 0
    for player in players:
        nfl_team_id = player.team_id
        if nfl_team_status.get(nfl_team_id, False):  # Check if the team is active
            players_left_count += 1

    return players_left_count


def get_team_fantasy_points_by_week(team_id, league_id, week):
    # Fetch the league settings for scoring details
    league_settings = LeagueSettings.query.filter_by(league_id=league_id).first()
    if not league_settings:
        raise ValueError(f"League settings for league {league_id} not found")

    # Fetch the lineup for the given team and week
    lineup = Lineup.query.filter_by(team_id=team_id, week_id=week).first()
    if not lineup:
        raise ValueError(f"Lineup for team {team_id} and week {week} not found")

    # Fetch the games for the wild card week
    games = GameStats.query.filter_by(week=week, team_id=team_id).all()

    # Calculate points
    total_points = 0
    player_scores = {}

    for game in games:
        # Fetch player_stats from the JSONB field
        player_stats = json.loads(game.player_stats)

        for player_id, stats in player_stats.items():
            # Fetch the player
            player = NFLPlayer.query.filter_by(id=player_id).first()
            if not player:
                continue

            # Calculate player points based on the stats and league settings
            points = calculate_player_points(stats, league_settings)
            player_scores[player_id] = points

    # Save player scores
    for player_id, points in player_scores.items():
        player_score = PlayerScore.query.filter_by(lineup_id=lineup.id, player_id=player_id).first()
        if player_score:
            player_score.points = points
        else:
            player_score = PlayerScore(lineup_id=lineup.id, player_id=player_id, points=points)
            db.session.add(player_score)
    db.session.commit()

    # Fetch player lineups for the team and week
    total_points = sum(player_scores.values())

    return total_points
