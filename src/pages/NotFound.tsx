import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Pagina niet gevonden</p>
        <a href={isAdmin ? "/admin" : "/"} className="text-primary underline hover:text-primary/90">
          {isAdmin ? "Terug naar Dashboard" : "Terug naar Home"}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
