import type { Metadata } from 'next';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';

const inter = Inter({ subsets: ['latin'] });
const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-display' });

export const metadata: Metadata = {
  title: {
    default: 'Parsel | Evidence-informed food relief planning',
    template: '%s · Parsel',
  },
  description:
    'Parsel helps San Diego food-relief teams combine inventory, documented community signals, experimental hotspot forecasts, and operator-reviewed drone observations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${display.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
