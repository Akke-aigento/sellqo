import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NoAccess() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="h-8 w-8 text-destructive" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Geen toegang</h1>
          <p className="text-muted-foreground">
            Je rol heeft geen toegang tot deze pagina. Vraag een tenant-admin
            om je rechten aan te passen.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button asChild variant="outline">
            <Link to="/admin">Terug naar dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
