def join_nfl_player_list_and_team_with_stats(player_list, team_data):
    for team_player in team_data:
        player_id = team_player["playerID"]
        player_list_player = [d for d in player_list if d["playerID"] == player_id][0]
        player_list_player["stats"] = team_player["stats"]
    return player_list
