function onEdit(e) {
  const range = e.range;
  const sheetName = range.getSheet().getName();
  if (e.triggerUid) {
    if (range.isChecked()) {
      if (sheetName === "Home") {
        if (range.getA1Notation() === "E12") {
          // Checkbox 1 in B2
          try {
            range.offset(0, -1).setValue("Running Script..."); // Display in the cell to the left
            updateNFLPlayoffGamesSheet();
          } finally {
            range.offset(0, -1).clearContent(); // Clear the indicator
            range.uncheck();
          }
        } else if (range.getA1Notation() === "E13") {
          // Checkbox 2 in C3
          try {
            range.offset(0, -1).setValue("Running Script..."); // Display in the cell to the left
            updatePlayerFantasyPoints();
          } finally {
            range.offset(0, -1).clearContent(); // Clear the indicator
            range.uncheck();
          }
        }
      }
    }
  }
}
