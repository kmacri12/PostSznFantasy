// src/pages/PlayersPage.tsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import PlayersTable from "../components/players/PlayersTable";

function PlayersPage() {
  return (
    <div>
      <PlayersTable />
    </div>
  );
}

export default PlayersPage;
