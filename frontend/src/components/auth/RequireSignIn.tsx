import { Container } from "@mui/material";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "../../contexts/UserContext";
import { signInPath } from "../../utils/authRedirect";
import LoadingState from "../common/LoadingState";

const RequireSignIn = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useUser();
  const { pathname, search } = useLocation();

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <LoadingState what="your account" rows={2} />
      </Container>
    );
  }
  if (!user) return <Navigate to={signInPath(pathname + search)} replace />;
  return children;
};

export default RequireSignIn;
