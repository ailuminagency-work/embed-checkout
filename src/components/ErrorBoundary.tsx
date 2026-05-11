import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;
  /** Short label identifying which part of the app this boundary wraps — stored in error_logs */
  label?: string;
}

interface State {
  error: Error | null;
  reported: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, reported: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    supabase
      .from("error_logs")
      .insert({
        message: error.message,
        stack: error.stack ?? null,
        component: this.props.label ?? "unknown",
        context: info.componentStack ?? null,
      })
      .then(() => {});
  }

  private handleReport = () => {
    if (this.state.reported || !this.state.error) return;
    supabase
      .from("error_logs")
      .insert({
        message: this.state.error.message,
        stack: this.state.error.stack ?? null,
        component: (this.props.label ?? "unknown") + " (manual report)",
        context: null,
      })
      .then(() => {
        this.setState({ reported: true });
      });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center min-h-[200px] p-8">
          <div className="max-w-md w-full rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              This section encountered an unexpected error. Your other work is not affected.
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Reload page
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={this.handleReport}
                disabled={this.state.reported}
              >
                {this.state.reported ? "Reported" : "Report issue"}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
