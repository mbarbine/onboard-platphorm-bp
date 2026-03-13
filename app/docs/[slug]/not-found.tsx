import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileQuestion, ArrowLeft, Search, BookOpen } from 'lucide-react'

export default function DocumentNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <FileQuestion className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">Document Not Found</CardTitle>
          <CardDescription>
            This document does not exist, may have been moved, or is not yet published.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Link href="/docs">
              <Button variant="default" className="w-full gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Documentation
              </Button>
            </Link>
            <Link href="/search">
              <Button variant="outline" className="w-full gap-2">
                <Search className="h-4 w-4" />
                Search Docs
              </Button>
            </Link>
            <Link href="/submit">
              <Button variant="outline" className="w-full gap-2">
                <BookOpen className="h-4 w-4" />
                Submit Content
              </Button>
            </Link>
          </div>
          <div className="text-xs text-center text-muted-foreground space-y-1">
            <p>Looking for something specific?</p>
            <p>Try searching or browse our documentation categories.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
