import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Site Crawler Dashboard',
  description: 'Control panel for automated site crawling and Go Agent analysis',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground min-h-screen flex flex-col`}>
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
                SC
              </div>
              <h1 className="text-xl font-semibold tracking-tight">Crawler Dashboard</h1>
            </div>
          </div>
        </header>

        <main className="flex-1 container mx-auto p-4 md:p-8">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  )
}
