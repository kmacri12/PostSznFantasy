import os
import requests
import json


class RapidApi:
    def __init__(self):
        self.base_url = os.getenv("RAPIDAPI_BASEURL")
        self.headers = {
            "X-RapidAPI-Key": os.getenv("RAPIDAPI_APIKEY"),
            "X-RapidAPI-Host": os.getenv("RAPIDAPI_APIHOST"),
        }

    def update_players(self):
        route = "/getNFLPlayerList"
        full_url = self.base_url + route
        response = requests.get(full_url, headers=self.headers)
        response_json = json.loads(response.text)
        response_body = response_json["body"]
        x = ""
        return response_body
