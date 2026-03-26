/**
 * Layout Component - Main layout for host application
 */

import { ReactNode } from 'react';

interface LayoutProps {
  header?: ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
}

export default function Layout({ header, sidebar, children }: LayoutProps) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {header}
      <div style={{ display: 'flex', flex: 1 }}>
        {sidebar}
        <main style={{ flex: 1, padding: '1.5rem', backgroundColor: '#f9fafb' }}>{children}</main>
      </div>
      <footer
        style={{
          padding: '1.5rem',
          textAlign: 'center',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: 'white',
          color: '#6b7280',
          fontSize: '0.875rem',
        }}
      >
        Module Federation Monorepo - Powered by pnpm, Turborepo & Webpack 5
      </footer>
    </div>
  );
}
