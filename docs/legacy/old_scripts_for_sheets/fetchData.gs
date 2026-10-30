function fetchNFLPlayerList() {
  const url = 'https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLPlayerList';
  const headers = {
    'X-RapidAPI-Key': getApiKey(),
    'X-RapidAPI-Host': 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com'
  };
  const options = { headers, muteHttpExceptions: true };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const jsonData = JSON.parse(response.getContentText()).body;
    return jsonData;
  } catch (error) {
    console.error("Error fetching player list:", error.message);
    return []; // Return an empty array in case of an error
  }
}

function fetchNFLPlayoffGames() {
  const url = `https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLGamesForWeek?week=all&seasonType=post&season=${getYear()}`;
  const headers = {
    'X-RapidAPI-Key': getApiKey(), 
    'X-RapidAPI-Host': 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com'
  };
  const options = { headers, muteHttpExceptions: true };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const jsonData = JSON.parse(response.getContentText()).body;
    return jsonData; // Return the fetched game data
  } catch (error) {
    console.error("Error fetching playoff games:", error.message);
    return []; // Return an empty array in case of an error
  }
}