
class ScoringSettings {
  /**
   * @param {number} passYard 
   * @param {number} passTD 
   * @param {number} passInt 
   * @param {number} rushYard 
   * @param {number} rushTD 
   * @param {number} receivingReception 
   * @param {number} receivingYard 
   * @param {number} receivingTD 
   * @param {number} fumbleLost 
   * @param {number} twoPointConversion 
   * @param {number} dstYardsUnder100 
   * @param {number} dstYardsBetween101_200 
   * @param {number} dstYardsBetween201_300 
   * @param {number} dstYardsOver300 
   * @param {number} dstPoints0 
   * @param {number} dstPointsBetween1_13 
   * @param {number} dstPointsBetween14_21 
   * @param {number} dstPointsBetween22_28 
   * @param {number} dstPointsOver29 
   * @param {number} dstSack 
   * @param {number} dstInt 
   * @param {number} dstTD 
   * @param {number} dstSafety 
   * @param {number} dstFumbleRec
   */
  constructor(
    passYard,
    passTD,
    passInt,
    rushYard,
    rushTD,
    receivingReception,
    receivingYard,
    receivingTD,
    fumbleLost,
    twoPointConversion,
    dstYardsUnder100,
    dstYardsBetween101_200,
    dstYardsBetween201_300,
    dstYardsOver300,
    dstPoints0,
    dstPointsBetween1_13,
    dstPointsBetween14_21,
    dstPointsBetween22_28,
    dstPointsOver29,
    dstSack,
    dstInt,
    dstTD,
    dstSafety,
    dstFumbleRec
  ) {
    this.passYard = passYard;
    this.passTD = passTD;
    this.passInt = passInt;
    this.rushYard = rushYard;
    this.rushTD = rushTD;
    this.receivingReception = receivingReception;
    this.receivingYard = receivingYard;
    this.receivingTD = receivingTD;
    this.fumbleLost = fumbleLost;
    this.twoPointConversion = twoPointConversion;
    this.dstYardsUnder100 = dstYardsUnder100;
    this.dstYardsBetween101_200 = dstYardsBetween101_200;
    this.dstYardsBetween201_300 = dstYardsBetween201_300;
    this.dstYardsOver300 = dstYardsOver300;
    this.dstPoints0 = dstPoints0;
    this.dstPointsBetween1_13 = dstPointsBetween1_13;
    this.dstPointsBetween14_21 = dstPointsBetween14_21;
    this.dstPointsBetween22_28 = dstPointsBetween22_28;
    this.dstPointsOver29 = dstPointsOver29;
    this.dstSack = dstSack;
    this.dstInt = dstInt;
    this.dstTD = dstTD;
    this.dstSafety = dstSafety;
    this.dstFumbleRec = dstFumbleRec;
  }
}

/**
 * Reads all config values from the config sheet.
 *
 * @return {Object} An object containing all config values.
 */
function getConfigValues() {
  const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  if (!configSheet) throw new Error('Config sheet is missing.');
  const data = configSheet.getDataRange().getValues();
  return Object.fromEntries(data);
}

function getConfigValue(key) {
  const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  if (!configSheet) throw new Error('Config sheet is missing.');
  const data = configSheet.getDataRange().getValues();
  const config = Object.fromEntries(data);
  return config[key];
}

function getApiKey() {
  return getConfigValue('API_KEY');
}

function getYear() {
  return getConfigValue('YEAR');
}

function getCombineQBPts() {
  return getConfigValue('COMBINE_QB_PTS');
}

function getCombineKPts() {
  return getConfigValue('COMBINE_K_PTS');
}

function getTeams() {
  const teamsJson = getConfigValue('TEAMS');
  return JSON.parse(teamsJson || '[]'); // Ensure valid JSON
}


/**
 * Reads the scoring settings from the config sheet and returns a ScoringSettings object.
 *
 * @return {ScoringSettings} The scoring settings.
 */
function getScoringSettings() {
  const config = getConfigValues();

  return new ScoringSettings(
    parseFloat(config['SCORING_PASS_YARD']),
    parseFloat(config['SCORING_PASS_TD']),
    parseFloat(config['SCORING_PASS_INT']),
    parseFloat(config['SCORING_RUSH_YARD']),
    parseFloat(config['SCORING_RUSH_TD']),
    parseFloat(config['SCORING_RECEIVING_RECEPTION']),
    parseFloat(config['SCORING_RECEIVING_YARD']),
    parseFloat(config['SCORING_RECEIVING_TD']),
    parseFloat(config['SCORING_FUMBLE_LOST']),
    parseFloat(config['SCORING_TWO_POINT_CONVERSION']),
    parseFloat(config['SCORING_DST_YARDS_UNDER_100']),
    parseFloat(config['SCORING_DST_YARDS_BETWEEN_101_200']),
    parseFloat(config['SCORING_DST_YARDS_BETWEEN_201_300']),
    parseFloat(config['SCORING_DST_YARDS_OVER_300']),
    parseFloat(config['SCORING_DST_POINTS_0']),
    parseFloat(config['SCORING_DST_POINTS_BETWEEN_1_13']),
    parseFloat(config['SCORING_DST_POINTS_BETWEEN_14_21']),
    parseFloat(config['SCORING_DST_POINTS_BETWEEN_22_28']),
    parseFloat(config['SCORING_DST_POINTS_OVER_29']),
    parseFloat(config['SCORING_DST_SACK']),
    parseFloat(config['SCORING_DST_INT']),
    parseFloat(config['SCORING_DST_TD']),
    parseFloat(config['SCORING_DST_SAFETY']),
    parseFloat(config['SCORING_DST_FUMBLE_REC'])
  );
}
