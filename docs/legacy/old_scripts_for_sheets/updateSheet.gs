function updatePlayerFantasyPoints() {
  const playoffSheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("NFL Playoff Games");
  const playerSheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Players & Stats");
  const range = playerSheet.getRange("F2:I1000");
  range.clearContent();

  const playoffData = playoffSheet.getDataRange().getValues();
  const playerData = playerSheet.getDataRange().getValues();

  const baseURL =
    "https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLBoxScore";
  const headers = {
    "X-RapidAPI-Key": getApiKey(),
    "X-RapidAPI-Host":
      "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com",
  };

  const eliminatedTeams = [];
  const scoringSettings = getScoringSettings();

  for (let i = 1; i < playoffData.length; i++) {
    const gameID = playoffData[i][2];
    const params = {
      gameID: gameID,
      fantasyPoints: "true",
      twoPointConversions: scoringSettings.twoPointConversion.toString(),
      passYards: scoringSettings.passYard.toString(),
      passTD: scoringSettings.passTD.toString(),
      passInterceptions: scoringSettings.passInt.toString(),
      passAttempts: "0",
      passCompletions: "0",
      pointsPerReception: scoringSettings.receivingReception.toString(),
      carries: "0",
      rushYards: scoringSettings.rushYard.toString(),
      rushTD: scoringSettings.rushTD.toString(),
      fumbles: scoringSettings.fumbleLost.toString(),
      receivingYards: scoringSettings.receivingYard.toString(),
      receivingTD: scoringSettings.receivingTD.toString(),
      targets: "0",
      defTD: scoringSettings.dstTD.toString(),
    };

    var queryString = Object.keys(params)
      .map(function (key) {
        return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
      })
      .join("&");

    var url = baseURL + "?" + queryString;

    const options = { headers, method: "get", muteHttpExceptions: true };

    try {
      const response = UrlFetchApp.fetch(url, options);
      const responseBody = JSON.parse(response.getContentText());
      const playerStats = responseBody.body?.playerStats;
      const gameWeek = playoffData[i][3];

      if (playerStats) {
        processPlayerStats(playerSheet, playerData, playerStats, gameWeek);
      }

      updateDSTScores(responseBody, gameWeek);

      if (responseBody.body?.gameStatus === "Completed") {
        const { homeResult, home, away } = responseBody.body;
        eliminatedTeams.push(homeResult === "W" ? away : home);
      }
    } catch (error) {
      console.error(`Error fetching data for gameID ${gameID}:`, error.message);
    }
  }

  writeEliminatedTeams(eliminatedTeams);
  const updateQB = getCombineQBPts();
  const updatePK = getCombineKPts();
  if (updateQB || updatePK) {
    updateQBPKScores(playerSheet, updateQB, updatePK);
  }
}

function processPlayerStats(playerSheet, playerData, playerStats, gameWeek) {
  for (let j = 1; j < playerData.length; j++) {
    const player = playerData[j];
    const playerID = player[3]?.toString();
    const position = player[1];

    if (playerStats[playerID]) {
      let fantasyPoints = playerStats[playerID]?.fantasyPoints || 0;
      if (position === "PK") {
        fantasyPoints = (
          parseFloat(fantasyPoints) +
          calculateKickerScore(playerStats[playerID])
        ).toString();
      }
      const columnIndex = playerData[0].indexOf(gameWeek);
      if (columnIndex !== -1) {
        playerSheet.getRange(j + 1, columnIndex + 1).setValue(fantasyPoints);
      }
    }
  }
}

function writeEliminatedTeams(eliminatedTeams) {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Eliminated Teams");
  if (!sheet) return;
  sheet.getRange("A:A").clearContent();
  const range = sheet.getRange(1, 1, eliminatedTeams.length, 1);
  range.setValues(eliminatedTeams.map((team) => [team]));
}

function updatePlayersAndStatsSheet() {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Players & Stats");
  const playerList = fetchNFLPlayerList();

  // Filter for specific teams and positions
  const desiredTeams = getTeams();
  const desiredPositions = ["QB", "RB", "WR", "TE", "PK", "FB"];
  const filteredData = playerList.filter(
    (player) =>
      desiredTeams.includes(player.team) &&
      desiredPositions.includes(player.pos),
  );

  const playerData = filteredData.map((player) => [
    player.espnName,
    player.pos,
    player.team,
    player.playerID,
  ]);

  const dstData = desiredTeams.map((team) => [
    team + " DST",
    "DST",
    team,
    "000000",
  ]);

  const dataToWrite = [...playerData, ...dstData];
  const headers = ["Name", "Pos", "Team", "playerID"];

  // Clear and write data
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet
    .getRange(2, 1, dataToWrite.length, dataToWrite[0].length)
    .setValues(dataToWrite);

  // Add 'Player/Team/Pos' column
  const playerTeamPos = dataToWrite.map((player) => [
    `${player[0]} (${player[2]}) ${player[1]}`,
  ]);
  sheet
    .getRange(2, headers.length + 1, playerTeamPos.length, 1)
    .setValues(playerTeamPos);

  // Add game week headers if they don't exist
  const headersToAdd = [
    "Wild Card",
    "Divisional Round",
    "Conference Championship",
    "Super Bowl",
  ];
  const existingHeaders = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];
  let lastColumn = sheet.getLastColumn() + 1;
  for (const header of headersToAdd) {
    if (!existingHeaders.includes(header)) {
      sheet.getRange(1, lastColumn).setValue(header);
      lastColumn++;
    }
  }
}

function updateNFLPlayoffGamesSheet() {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("NFL Playoff Games");
  const gameData = fetchNFLPlayoffGames();
  const dataToWrite = gameData.map((game) => [
    game.home,
    game.away,
    game.gameID,
    game.gameWeek,
  ]);
  const headers = ["HOME", "AWAY", "gameID", "GameWeek"];

  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet
    .getRange(2, 1, dataToWrite.length, dataToWrite[0].length)
    .setValues(dataToWrite);
}
