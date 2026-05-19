import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { ParkingProvider } from '@/context/ParkingContext';

export const metadata: Metadata = {
  title: 'Sistem Manajemen Parkir',
  description: 'Aplikasi pengelolaan slot parkir dengan Global State Management',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <ParkingProvider>
          {children}
        </ParkingProvider>
      </body>
    </html>
  );
}
