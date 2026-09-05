import React from 'react';
import ko from '../i18n/ko.json';
import en from '../i18n/en.json';
import ja from '../i18n/ja.json';

interface State {
  hasError: boolean;
  error: Error | null;
}

function getErrorTitle() {
  const locale = (localStorage.getItem('jango-locale') || 'ko') as 'ko' | 'en' | 'ja';
  const dict = locale === 'en' ? en : locale === 'ja' ? ja : ko;
  return dict.errors?.appError || 'Application Error';
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', fontFamily: 'monospace' }}>
          <h2 style={{ color: 'red' }}>{getErrorTitle()}</h2>
          <pre style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px', overflow: 'auto', fontSize: '12px' }}>
            {this.state.error?.toString()}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
