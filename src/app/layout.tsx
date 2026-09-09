import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Northstar Security Console",
  description: "Secure asset and incident management dashboard",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <html
      lang="en"
      className="h-full antialiased"
      nonce={nonce}
    >
      <body nonce={nonce} className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
