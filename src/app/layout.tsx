
import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

const geistSans = GeistSans; 

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
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
