import "@/app/globals.css";
import Providers from '@/components/Providers';

import { Inter } from "next/font/google";

import LayoutSwitcher from "@/components/layouts/LayoutSwitcher";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "LadderChat",
  description: "Automate your laddering process",
};


export default function RootLayout({ children }) {

  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <LayoutSwitcher>{children}</LayoutSwitcher>
        </Providers>
      </body>
      
    </html>
  )
}
