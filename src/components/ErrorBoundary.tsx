import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { reloadWithFreshFiles } from "@/lib/app-recovery";

interface Props { children: ReactNode; label?: string; compact?: boolean }
interface State { error: Error | null }

/** Catches crashes so a broken section never turns the whole app into a black screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info.componentStack);
    // Outdated files after a new version was published: reload once with fresh files.
    if (/dynamically imported module|Loading chunk|Importing a module script failed|MIME type/i.test(String(error?.message))) {
      reloadWithFreshFiles();
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.compact) {
      return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm space-y-3">
          <div className="flex items-center gap-2 text-destructive font-medium">
            <AlertTriangle className="h-4 w-4" /> Cette section a rencontré un problème
          </div>
          <Button size="sm" variant="outline" onClick={this.reset} className="h-9">
            <RefreshCw className="h-4 w-4 mr-2" /> Réessayer
          </Button>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-sm w-full text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-lg font-semibold text-foreground">Oups, un problème est survenu</h1>
          <p className="text-sm text-muted-foreground">Vos données sont en sécurité. Rechargez l'application pour continuer.</p>
          <Button className="w-full h-12 bg-gradient-primary" onClick={() => reloadWithFreshFiles(true)}>
            <RefreshCw className="h-4 w-4 mr-2" /> Recharger l'application
          </Button>
        </div>
      </div>
    );
  }
}
