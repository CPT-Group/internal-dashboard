'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Message } from 'primereact/message';

interface SlideErrorBoundaryProps {
  /** Human label for the slide/widget (shown in the localized fallback). */
  label: string;
  children: ReactNode;
}

interface SlideErrorBoundaryState {
  error: Error | null;
}

/**
 * Per-slide/widget error isolation. A render-time error inside `children` is caught here and shown
 * as a LOCALIZED message, so one failing slide can never blank the rest of the carousel (or bubble
 * to Next.js `global-error` and take down the whole app). This is the missing isolation layer that
 * let a Jira slide's failure blank the healthy GitHub slide.
 */
export class SlideErrorBoundary extends Component<SlideErrorBoundaryProps, SlideErrorBoundaryState> {
  state: SlideErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SlideErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface for debugging without crashing the app.
    // eslint-disable-next-line no-console
    console.error(`[SlideErrorBoundary] "${this.props.label}" failed:`, error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <Message
          severity="error"
          text={`${this.props.label} is temporarily unavailable`}
          className="w-full m-2"
        />
      );
    }
    return this.props.children;
  }
}
