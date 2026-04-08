import './global.css';

export const metadata = {
  title: 'KANT Labs',
  description: 'Trust, A Priori.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
