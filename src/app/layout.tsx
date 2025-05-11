import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
// import { GeistMono } from 'geist/font/mono'; // Removed to fix "Module not found" error
import './globals.css';

const geistSans = GeistSans; // No need to call as a function if using default import
// const geistMono = GeistMono; // Removed

export const metadata: Metadata = {
  title: 'ServerSpotlight',
  description: 'Discover and vote for the best game servers.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): JSX.Element {
  return (
    <html lang="en" className={`${geistSans.variable}`} suppressHydrationWarning={true}>
      <body className="antialiased" suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}
