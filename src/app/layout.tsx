import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

const geistSans = GeistSans; // No need to call as a function if using default import
const geistMono = GeistMono; // No need to call as a function if using default import

export const metadata: Metadata = {
  title: 'ServerSpotlight',
  description: 'Discover and vote for the best game servers.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
