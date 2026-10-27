import axios from "axios";
// src/pages/PlayersPage.tsx
import React, { useState, useEffect } from "react";
import PlayersTable from "../components/players/PlayersTable";

function PlayersPage() {
  return (
    <div>
      <PlayersTable />
    </div>
  );
}

export default PlayersPage;
