import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Island Pantry | Sri Lankan Groceries',
  description: 'Sri Lankan groceries and everyday pantry essentials.',
  icons: { icon: '/market/mark.svg' },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-LK"><body>{children}</body></html>;
}
