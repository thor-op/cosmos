import type {Metadata} from 'next';
import { Space_Mono, DM_Sans } from 'next/font/google';
import './globals.css'; // Global styles

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
});

export const metadata: Metadata = {
  title: 'COSMOS - NASA Data Explorer',
  description: 'A minimal-dark NASA data explorer featuring Mars Weather, NEO Tracker, and ISS Live Tracker.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <body className="bg-[#080808] text-white font-sans antialiased selection:bg-white/20" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
