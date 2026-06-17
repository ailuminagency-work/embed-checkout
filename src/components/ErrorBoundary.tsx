import React, { Component, ReactNode } from "react";

interface Props { children: ReactNode; fallback?: ReactNode; label?: string; }
interface State { hasError: boolean; error: Error | null; }

// Catches render-time errors so the app/widget never white-screens.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary: ${this.props.label ?? "root"}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: 32, textAlign: "center", fontFamily: "-apple-system, sans-serif" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <h3 style={{ marginBottom: 8, color: "#111827" }}>Something went wrong</h3>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ padding: "8px 20px", background: "#0d9488", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
