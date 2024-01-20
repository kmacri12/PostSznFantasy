import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
} from "react-router-dom";
import League from "./components/League";
import Team from "./components/Team";
import Players from "./components/Players";
import Draft from "./components/Draft";
import "./App.css";

function App() {
  return (
    <Router>
      <div className="app-container">
        <div className="left-navigation">
          <NavLink to="/league" activeClassName="active-tab">
            {/* Logo or Icon for Leagues */}
          </NavLink>
          <NavLink to="/team" activeClassName="active-tab">
            {/* Logo or Icon for My Team */}
          </NavLink>
          <NavLink to="/players" activeClassName="active-tab">
            {/* Logo or Icon for Players */}
          </NavLink>
          <NavLink to="/draft" activeClassName="active-tab">
            {/* Logo or Icon for Players */}
          </NavLink>
        </div>

        <div className="main-content">
          <Routes>
            <Route path="/league" element={<League />} />
            <Route path="/team" element={<Team />} />
            <Route path="/players" element={<Players />} />
            <Route path="/draft" element={<Draft />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
