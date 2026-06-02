import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nestora",
  description: "Search approved rentals, manage listings, and review trusted landlord verification with Nestora.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
