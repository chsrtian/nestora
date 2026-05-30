import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rental Marketplace",
  description: "Search approved rentals, manage listings, and review trusted landlord verification.",
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
