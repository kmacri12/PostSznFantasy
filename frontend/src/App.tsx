import React, { useState, useEffect } from 'react';
import { Route, Routes, Link } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LeaguePage from './pages/LeaguePage';
import TeamPage from './pages/TeamPage';
import PlayersPage from './pages/PlayersPage';
import DraftPage from './pages/DraftPage';
import SettingsPage from './pages/SettingsPage';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, EmailAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';


const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_AUTH_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_AUTH_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase app
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

const uiConfig = {
  signInFlow: 'popup',
  signInOptions: [
    GoogleAuthProvider.PROVIDER_ID,
    EmailAuthProvider.PROVIDER_ID,
    // Other sign-in options...
  ],
  callbacks: {
    signInSuccessWithAuthResult: () => false, // Avoid redirect after sign-in
  },
};

function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    // Clean up subscription
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div>
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" aria-label="menu">
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component={Link} to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            PostSznFantasy
          </Typography>
          <Button component={Link} to="/league" style={{ textTransform: 'none', color: 'inherit' }}>League</Button>
          <Button component={Link} to="/team" style={{ textTransform: 'none', color: 'inherit' }}>Team</Button>
          <Button component={Link} to="/players" style={{ textTransform: 'none', color: 'inherit' }}>Players</Button>
          <Button component={Link} to="/draft" style={{ textTransform: 'none', color: 'inherit' }}>Draft</Button>
          <Button component={Link} to="/settings" style={{ textTransform: 'none', color: 'inherit' }}>Settings</Button>
          {user ? (
            <Button onClick={handleSignOut} style={{ textTransform: 'none', color: 'inherit' }}>Sign out</Button>
          ) : (
            <Button onClick={handleSignIn} style={{ textTransform: 'none', color: 'inherit' }}>Sign in with Google</Button>
          )}
        </Toolbar>
      </AppBar>
      <Routes>
      <Route path="/league" element={<LeaguePage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/draft" element={<DraftPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </div>
  );
}


// function App() {
//   return (
//     <div>
//       <AppBar position="static">
//         <Toolbar>
//           <IconButton edge="start" color="inherit" aria-label="menu">
//             <MenuIcon />
//           </IconButton>
//           <Typography variant="h6" component={Link} to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
//             PostSznFantasy
//           </Typography>
//           <Button component={Link} to="/league" style={{ textTransform: 'none', color: 'inherit' }}>League</Button>
//           <Button component={Link} to="/team" style={{ textTransform: 'none', color: 'inherit' }}>Team</Button>
//           <Button component={Link} to="/players" style={{ textTransform: 'none', color: 'inherit' }}>Players</Button>
//           <Button component={Link} to="/draft" style={{ textTransform: 'none', color: 'inherit' }}>Draft</Button>
//           <Button component={Link} to="/settings" style={{ textTransform: 'none', color: 'inherit' }}>Settings</Button>
//         </Toolbar>
//       </AppBar>
//       <Routes>

//       </Routes>
//     </div>
//   );
// }

export default App;
