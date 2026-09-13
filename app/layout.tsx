import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { readSession } from "@/lib/session";
import { Header } from "@/components/Header";
import { SessionKeepAlive } from "@/components/SessionKeepAlive";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ivy Homes",
  description: "Property marketplace built on the Ivy Homes API",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await readSession();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {session && <Header email={session.email} />}
        {session && <SessionKeepAlive />}
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
