import os
import json
import logging
import requests
import requests_cache


class RapidApi:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.base_url = os.getenv("RAPIDAPI_BASEURL")
        self.headers = {
            "X-RapidAPI-Key": os.getenv("RAPIDAPI_APIKEY"),
            "X-RapidAPI-Host": os.getenv("RAPIDAPI_APIHOST"),
        }

    def get_nfl_teams(self) -> list[dict]:
        try:
            route = "/getNFLTeams"
            full_url = self.base_url + route
            requests_cache.install_cache("getNFLTeams")
            response = requests.get(full_url, headers=self.headers, timeout=60)
            requests_cache.uninstall_cache()
            response_json = json.loads(response.text)
            response_body = response_json["body"]
            return response_body
        except Exception:
            self.logger.exception("Exception caught while getting nfl teams")
            return []

    def get_nfl_players(self) -> list[dict]:
        try:
            route = "/getNFLPlayerList"
            full_url = self.base_url + route
            requests_cache.install_cache(
                "getNFLPlayerList", expires_after=2629744
            )  # expire in 1 month
            response = requests.get(full_url, headers=self.headers, timeout=60)
            requests_cache.uninstall_cache()
            response_json = json.loads(response.text)
            response_body = response_json["body"]
            return response_body
        except Exception:
            self.logger.exception("Exception caught while getting nfl players list")
            return []

    def get_nfl_games_list(
        self, season: str, season_type: str, week: str = "all"
    ) -> list[dict]:
        try:
            route = "/getNFLGamesForWeek"
            full_url = self.base_url + route
            requests_cache.install_cache("getNFLGamesForWeek")
            params = {"week": week, "seasonType": season_type, "season": season}
            response = requests.get(
                full_url, headers=self.headers, params=params, timeout=60
            )
            requests_cache.uninstall_cache()
            response_json = json.loads(response.text)
            response_body = response_json["body"]
            return response_body
        except Exception:
            self.logger.exception("Exception caught while getting nfl games list")
            return []

    def get_nfl_box_score(self, game_id: str) -> dict:
        try:
            route = "/getNFLBoxScore"
            full_url = self.base_url + route
            requests_cache.install_cache("getNFLBoxScore")
            params = {"gameID": game_id}
            response = requests.get(
                full_url, headers=self.headers, params=params, timeout=60
            )
            requests_cache.uninstall_cache()
            response_json = json.loads(response.text)
            response_body = response_json["body"]
            return response_body
        except Exception:
            self.logger.exception("Exception caught while getting nfl box score")
            return {}

    def get_stats_for_team(self, team_id: str, team_abv: str) -> list[dict]:
        try:
            route = "/getNFLTeamRoster"
            full_url = self.base_url + route
            params = {"teamID": team_id, "teamAbv": team_abv, "getStats": "true"}
            response = requests.get(
                full_url, headers=self.headers, params=params, timeout=60
            )
            response_json = json.loads(response.text)
            response_body = response_json["body"]
            roster = response_body["roster"]
            return roster

        except Exception:
            self.logger.exception("Exception caught while getting players and stats")
            return []
