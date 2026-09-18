import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "創客學院｜Course Engine", description: "把課程內容變成學員做得出來的成果。" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant" className="antialiased"><body>{children}</body></html>;
}
