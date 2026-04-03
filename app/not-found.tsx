import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileQuestion, Home, Search, Book } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <FileQuestion className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">Page Not Found</CardTitle>
          <CardDescription>
            The page you are looking for does not exist or has been moved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Button variant="default" className="w-full gap-2" asChild>
              <Link href="/">
                <Home className="h-4 w-4" />
                Go to Home
              </Link>
            </Button>
            <Button variant="outline" className="w-full gap-2" asChild>
              <Link href="/docs">
                <Book className="h-4 w-4" />
                Browse Documentation
              </Link>
            </Button>
            <Button variant="outline" className="w-full gap-2" asChild>
              <Link href="/search">
                <Search className="h-4 w-4" />
                Search Docs
              </Link>
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            If you believe this is an error, please check the URL or contact support.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
