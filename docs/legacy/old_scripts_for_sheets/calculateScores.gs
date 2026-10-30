function calculateKickerScore(playerStats) {
  let fantasyPoints = 0;
  if (playerStats.Kicking) {
    const fgMissed = playerStats.Kicking.fgAttempts - playerStats.Kicking.fgMade;
    const xpMissed = playerStats.Kicking.xpAttempts - playerStats.Kicking.xpMade;
    const totalMissedKicks = fgMissed + xpMissed;
    const totalMadeXP = parseFloat(playerStats.Kicking.xpMade);
    let totalFieldGoalYards = 0;
    if (playerStats.scoringPlays) {
      for (const play of playerStats.scoringPlays) {
        if (play.scoreType === "FG") {
          const match = play.score.match(/\d+/);
          if (match) {
            const fgYards = parseInt(match[0]);
            totalFieldGoalYards += fgYards;
          }
        }
      }
    }
    fantasyPoints = (totalFieldGoalYards * 0.1) + totalMadeXP - totalMissedKicks;
  }
  return fantasyPoints;
}

function updateQBPKScores(playerSheet, updateQB, updatePK) { 
  const data = playerSheet.getDataRange().getValues();
  const qbScores = {};
  const pkScores = {};

  for (let i = 1; i < data.length; i++) {
    const pos = data[i][1]; 
    const team = data[i][2]; 
    for (let game = 5; game < 9; game++) {
      const score = parseFloat(data[i][game]);
      if (pos === 'QB') {
        if (!qbScores[team]) qbScores[team] = {};
        if (!qbScores[team][game]) qbScores[team][game] = { rows: [], score: 0 };
        if (score) qbScores[team][game].score += score;
        qbScores[team][game].rows.push(i);
      } else if (pos === 'PK') {
        if (!pkScores[team]) pkScores[team] = {};
        if (!pkScores[team][game]) pkScores[team][game] = { rows: [], score: 0 };
        if (score) pkScores[team][game].score += score;
        pkScores[team][game].rows.push(i);
      }
    }
  }

  if (updateQB){
    for (const team in qbScores) {
      for (const game in qbScores[team]) {
        const totalScore = qbScores[team][game].score;
        if (totalScore !== 0) {
          for (const row of qbScores[team][game].rows) {
            data[row][game] = totalScore;
          }
        }
      }
    }
  }

  if (updatePK) {
    for (const team in pkScores) {
      for (const game in pkScores[team]) {
        const totalScore = pkScores[team][game].score;
        if (totalScore !== 0) {
          for (const row of pkScores[team][game].rows) {
            data[row][game] = totalScore;
          }
        }
      }
    }
  }

  playerSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
}

function updateDSTScores(responseBody, gameWeek) {
  const scoringSettings = getScoringSettings();
  const columnIndex = ['Wild Card', 'Divisional Round', 'Conference Championship', 'Super Bowl'].indexOf(gameWeek) + 6;
  if (responseBody.body?.teamStats && columnIndex !== -1) {
    const dstTracker = {};
    const teamStats = responseBody.body.teamStats;
    for (const teamKey in teamStats) {
      const team = teamStats[teamKey];
      const teamname = team['team'];
      dstTracker[teamname] = {
        "totalOffYards": parseInt(team['totalYards']),
        'intThrown': parseInt(team['interceptionsThrown']),
        'fumblesLost': parseInt(team['fumblesLost']),
        'sacksAllowed': parseInt(team['sacksAndYardsLost'].split('-')[0]),
        'dstTds': parseInt(team['defensiveOrSpecialTeamsTds']),
        'defensiveTwoPointConversionReturns': parseInt(team['defensiveTwoPointConversionReturns'])
      };
    }
    const awayTeam = responseBody.body['away'];
    const homeTeam = responseBody.body['home'];
    dstTracker[awayTeam]['offPtsScored'] = responseBody.body['lineScore']['away']['totalPts'] - (6 * dstTracker[awayTeam]['dstTds']);
    dstTracker[homeTeam]['offPtsScored'] = responseBody.body['lineScore']['home']['totalPts'] - (6 * dstTracker[homeTeam]['dstTds']);

    let awayDSTFpts = calculateDSTPoints(dstTracker[homeTeam], dstTracker[awayTeam]);
    let homeDSTFpts = calculateDSTPoints(dstTracker[awayTeam], dstTracker[homeTeam]); 


    for (const scoringPlay of responseBody.body.scoringPlays) {
      if (scoringPlay['scoreType'] === 'SF') {
        if (scoringPlay['team'] === homeTeam) {
          homeDSTFpts += scoringSettings.dstSafety;
        } else {
          awayDSTFpts += scoringSettings.dstSafety;
        }
      }
    }

    const playerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Players & Stats');
    const range = playerSheet.getRange("B:C");
    const values = range.getValues();

    for (let i = 0; i < values.length; i++) {
      if (values[i][0] === "DST" && values[i][1] === homeTeam) {
        playerSheet.getRange(i + range.getRow(), columnIndex).setValue(homeDSTFpts);
      } else if (values[i][0] === "DST" && values[i][1] === awayTeam) {
        playerSheet.getRange(i + range.getRow(), columnIndex).setValue(awayDSTFpts);
      }
    }
  }
}

function calculateDSTPoints(opponentStats, teamStats) {
  const scoringSettings = getScoringSettings();
  let points = 0;
  if (opponentStats.totalOffYards <= 100) {
    points += scoringSettings.dstYardsUnder100;
  } else if (100 < opponentStats.totalOffYards && opponentStats.totalOffYards <= 200) {
    points += scoringSettings.dstYardsBetween101_200;
  } else if (200 < opponentStats.totalOffYards && opponentStats.totalOffYards <= 300) {
    points += scoringSettings.dstYardsBetween201_300;
  } else {
    points += scoringSettings.dstYardsOver300;
  }

  if (opponentStats.offPtsScored == 0) {
    points += scoringSettings.dstPoints0;
  } else if (1 <= opponentStats.offPtsScored && opponentStats.offPtsScored <= 13) {
    points += scoringSettings.dstPointsBetween1_13;
  } else if (14 <= opponentStats.offPtsScored && opponentStats.offPtsScored <= 21) {
    points += scoringSettings.dstPointsBetween14_21;
  } else if (22 <= opponentStats.offPtsScored && opponentStats.offPtsScored <= 28) {
    points += scoringSettings.dstPointsBetween22_28;
  } else {
    points += scoringSettings.dstPointsOver29;
  }

  points += (opponentStats['intThrown'] * scoringSettings.dstInt);
  points += (opponentStats['sacksAllowed'] * scoringSettings.dstSack);
  points += (opponentStats['fumblesLost'] * scoringSettings.dstFumbleRec);
  points += (teamStats['defensiveTwoPointConversionReturns'] * 2)
  points += (teamStats['dstTds'] * scoringSettings.dstTD);


  return points;
}