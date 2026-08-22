import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://fotobingo-maker.dennisdelphine.chatgpt.site"),
  title: "Fotobingo Maker",
  description: "Maak unieke, printklare bingokaarten met je eigen foto’s — veilig in je browser.",
  openGraph: { title: "Fotobingo Maker", description: "Unieke bingokaarten met je eigen foto’s.", type: "website", images: [{ url: "/og.png", width: 1200, height: 630, alt: "Fotobingo Maker" }] },
  twitter: { card: "summary_large_image", title: "Fotobingo Maker", description: "Unieke bingokaarten met je eigen foto’s.", images: ["/og.png"] },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body>{children}</body></html>;
}
