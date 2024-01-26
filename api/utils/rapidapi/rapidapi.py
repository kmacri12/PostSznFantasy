import os
import json
import logging
import requests
from api.utils.data_utils import join_nfl_player_list_and_team_with_stats


class RapidApi:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.base_url = os.getenv("RAPIDAPI_BASEURL")
        self.headers = {
            "X-RapidAPI-Key": os.getenv("RAPIDAPI_APIKEY"),
            "X-RapidAPI-Host": os.getenv("RAPIDAPI_APIHOST"),
        }

    def update_players_and_stats(self):
        try:
            filepath = os.path.join(os.getcwd(), "api/data/NflPlayerList.json")
            if not os.path.exists(filepath):
                self.update_players()
            # for teamnum in 1-32
            route = "/getNFLTeamRoster"
            full_url = self.base_url + route
            params = {"teamID": "6", "teamAbv": "CHI", "getStats": "true"}
            response = requests.get(
                full_url, headers=self.headers, params=params, timeout=60
            )
            response_json = json.loads(response.text)
            response_body = response_json["body"]
            roster = response_body["roster"]
            with open(filepath, "r") as f:
                data = json.load(f)
            data = join_nfl_player_list_and_team_with_stats(data, roster)
            with open(filepath, "w") as f:
                json.dump(data, f)
            return data

        except Exception:
            self.logger.exception("Exception caught while getting players and stats")
            return []

    def update_players(self):
        try:
            route = "/getNFLPlayerList"
            full_url = self.base_url + route
            response = requests.get(full_url, headers=self.headers, timeout=60)
            response_json = json.loads(response.text)
            response_body = response_json["body"]
            filepath = os.path.join(os.getcwd(), "api/data/NflPlayerList.json")
            with open(filepath, "w") as f:
                json.dump(response_body, f)

            return response_body
            ## TODO change this return with saving the data somewhere
        except Exception:
            self.logger.exception(
                "Exception caught while getting updated NFL Player List"
            )
            return []
