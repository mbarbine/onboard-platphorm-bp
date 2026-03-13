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
            <Link href="/">
              <Button variant="default" className="w-full gap-2">
                <Home className="h-4 w-4" />
                Go to Home
              </Button>
            </Link>
            <Link href="/docs">
              <Button variant="outline" className="w-full gap-2">
                <Book className="h-4 w-4" />
                Browse Documentation
              </Button>
            </Link>
            <Link href="/search">
              <Button variant="outline" className="w-full gap-2">
                <Search className="h-4 w-4" />
                Search Docs
              </Button>
            </Link>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            If you believe this is an error, please check the URL or contact support.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
