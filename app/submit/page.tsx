'use client'

import { useState, useEffect, useCallback } from 'react'
import { MarkdownRenderer } from "@/components/markdown-renderer"
import Link from 'next/link'
import { DocsLayout } from '@/components/docs-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { BASE_URL } from '@/lib/site-config'
import {

  FileText,
  Send,
  CheckCircle,
  AlertCircle,
  Loader2,
  Globe,
  User,
  Mail,
  Link as LinkIcon,
  Download,
  Info,
  Tag,
  FolderOpen,
  Save,
  Clock,
  Eye,
  Share2,
  Sparkles,
  Users,
  Copy,
  ExternalLink,
} from 'lucide-react'

interface SubmissionResult {
  success: boolean
  data?: {
    id: string
    source_identifier: string
    status: string
    message: string
    slug?: string
    url?: string
    emoji_summary?: string
  }
  error?: {
    message: string
  }
}

interface Category {
  slug: string
  name: string
  description: string | null
  icon: string | null
  document_count: number
}

interface SessionData {
  session_id: string
  fingerprint: string
  locale: string
  geo: { country: string | null; region: string | null; city: string | null }
  preferences: Record<string, unknown>
  draft_content: Record<string, unknown>
}

interface ShareLink {
  platform: string
  url: string
  icon: string
}

const DRAFT_KEY = 'submission_draft'
const AUTOSAVE_INTERVAL = 10000 // 10 seconds

export default function SubmitPage() {
  const [mode, setMode] = useState<'url' | 'manual'>('url')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isIngesting, setIsIngesting] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [result, setResult] = useState<SubmissionResult | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [baseUrl, setBaseUrl] = useState(BASE_URL)
  const [session, setSession] = useState<SessionData | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([])
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  
  const [ingestUrl, setIngestUrl] = useState('')
  const [autoPublish, setAutoPublish] = useState(true)
  const [formData, setFormData] = useState({
    source_url: '',
    title: '',
    content: '',
    description: '',
    author_name: '',
    author_email: '',
    category: '',
    tags: '',
    target_audience: '',
    emoji_summary: '',
  })

  // Fetch categories from API
  const fetchCategories = useCallback(() => {
    fetch('/api/v1/categories')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data?.flat && Array.isArray(data.data.flat)) {
          setCategories(data.data.flat)
        } else if (data.success && Array.isArray(data.data)) {
          // Fallback for alternative response formats
          setCategories(data.data)
        } else {
          setCategories([])
        }
      })
      .catch((err) => { console.error('Failed to fetch categories:', err); setCategories([]) })
  }, [])

  // Initialize session and load draft
  useEffect(() => {
    // Get session with fingerprinting
    fetch('/api/session')
      .then(res => res.json())
      .then((data: SessionData) => {
        setSession(data)
        // Check for saved draft
        if (data.draft_content?.[DRAFT_KEY]) {
          const draft = data.draft_content[DRAFT_KEY] as { data: typeof formData; savedAt: string }
          if (draft.data) {
            setFormData(draft.data)
            setLastSaved(new Date(draft.savedAt))
          }
        }
      })
      .catch(console.error)
    
    // Fetch categories
    fetchCategories()
    
    // Fetch base URL
    fetch('/api/v1/settings')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data.settings.base_url) {
          setBaseUrl(data.data.settings.base_url)
        }
      })
      .catch(console.error)
  }, [fetchCategories])

  // Auto-save draft
  const saveDraft = useCallback(async () => {
    if (!session?.session_id) return
    if (!formData.title && !formData.content && !formData.source_url) return
    
    setIsSavingDraft(true)
    try {
      await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_draft',
          key: DRAFT_KEY,
          data: { data: formData },
        }),
      })
      setLastSaved(new Date())
    } catch (error) {
      console.error('Failed to save draft:', error)
    } finally {
      setIsSavingDraft(false)
    }
  }, [session?.session_id, formData])

  // Auto-save interval
  useEffect(() => {
    const interval = setInterval(saveDraft, AUTOSAVE_INTERVAL)
    return () => clearInterval(interval)
  }, [saveDraft])

  // Generate share links when result is successful
  useEffect(() => {
    if (result?.success && result.data?.slug) {
      const url = result.data.url || `${baseUrl}/docs/${result.data.slug}`
      const title = formData.title || 'New Document'
      
      setShareLinks([
        { platform: 'twitter', url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, icon: '𝕏' },
        { platform: 'linkedin', url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, icon: '💼' },
        { platform: 'facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, icon: '📘' },
        { platform: 'reddit', url: `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`, icon: '🔴' },
        { platform: 'hackernews', url: `https://news.ycombinator.com/submitlink?u=${encodeURIComponent(url)}&t=${encodeURIComponent(title)}`, icon: '🟧' },
        { platform: 'email', url: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(formData.description || 'Check this out!')}\n\n${encodeURIComponent(url)}`, icon: '📧' },
      ])
    }
  }, [result, baseUrl, formData.title, formData.description])

  const handleIngestUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ingestUrl) return
    
    setIsIngesting(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/v1/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: ingestUrl,
          category: formData.category || undefined,
          tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : undefined,
          target_audience: formData.target_audience || undefined,
          auto_publish: autoPublish,
        }),
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        setResult({ 
          success: true, 
          data: {
            id: data.data.id,
            source_identifier: data.data.source_identifier,
            status: data.data.status,
            message: `Document ingested successfully from ${ingestUrl}`,
            slug: data.data.slug,
            url: data.data.url,
            emoji_summary: data.data.emoji_summary,
          }
        })
        setIngestUrl('')
        // Clear draft after success
        clearDraft()
        // Refresh categories to include any newly auto-created category
        fetchCategories()
      } else {
        setResult({ 
          success: false, 
          error: { message: data.error?.message || data.error || 'Failed to ingest URL' }
        })
      }
    } catch {
      setResult({ 
        success: false, 
        error: { message: 'Network error. Please try again.' }
      })
    } finally {
      setIsIngesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setResult(null)

    try {
      const response = await fetch('/api/v1/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          content_format: 'markdown',
          tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : undefined,
          metadata: {
            submitted_via: 'web_form',
            session_id: session?.session_id,
            fingerprint: session?.fingerprint,
            geo: session?.geo,
          },
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult({ success: true, data: data.data })
        // Clear form and draft
        setFormData({
          source_url: '',
          title: '',
          content: '',
          description: '',
          author_name: '',
          author_email: '',
          category: '',
          tags: '',
          target_audience: '',
          emoji_summary: '',
        })
        clearDraft()
        // Refresh categories to include any newly created category
        fetchCategories()
      } else {
        setResult({ 
          success: false, 
          error: { message: data.error?.message || 'Submission failed' }
        })
      }
    } catch {
      setResult({ 
        success: false, 
        error: { message: 'Network error. Please try again.' }
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const clearDraft = async () => {
    if (!session?.session_id) return
    try {
      await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_draft',
          key: DRAFT_KEY,
          data: null,
        }),
      })
      setLastSaved(null)
    } catch (error) {
      console.error('Failed to clear draft:', error)
    }
  }

  const copyToClipboard = async (text: string, platform: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedLink(platform)
      setTimeout(() => setCopiedLink(null), 2000)
    } catch {
      console.error('Failed to copy')
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <DocsLayout categories={categories}>
        <div className="space-y-2 mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Submit Content</h1>
            {session && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {session.geo?.country && (
                  <Badge variant="outline" className="gap-1">
                    <Globe className="h-3 w-3" />
                    {session.geo.country}
                  </Badge>
                )}
                {lastSaved && (
                  <Badge variant="secondary" className="gap-1">
                    {isSavingDraft ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                    Saved {lastSaved.toLocaleTimeString()}
                  </Badge>
                )}
              </div>
            )}
          </div>
          <p className="text-lg text-muted-foreground text-pretty">
            Share your documentation, tutorials, or blog posts. Drafts auto-save every 10 seconds.
          </p>
        </div>

        {result?.success && (
          <Alert className="mb-8 border-green-500 bg-green-500/10">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle className="flex items-center gap-2">
              Success! 
              {result.data?.emoji_summary && (
                <span className="text-lg">{result.data.emoji_summary}</span>
              )}
            </AlertTitle>
            <AlertDescription className="space-y-4">
              <p>{result.data?.message || 'Content submitted successfully!'}</p>
              
              {result.data?.id && (
                <p>ID: <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">{result.data.id}</code></p>
              )}
              
              {result.data?.slug && (
                <div className="flex items-center gap-2">
                  <Link href={`/docs/${result.data.slug}`} className="text-primary underline inline-flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    View Document
                  </Link>
                </div>
              )}
              
              {shareLinks.length > 0 && (
                <div className="pt-2">
                  <p className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Share2 className="h-4 w-4" />
                    Share your content:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {shareLinks.map((link) => (
                      <div key={link.platform} className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="gap-1"
                        >
                          <a href={link.url} target="_blank" rel="noopener noreferrer">
                            <span>{link.icon}</span>
                            {link.platform.charAt(0).toUpperCase() + link.platform.slice(1)}
                          </a>
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => copyToClipboard(result.data?.url || `${baseUrl}/docs/${result.data?.slug}`, 'link')}
                    >
                      {copiedLink === 'link' ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedLink === 'link' ? 'Copied!' : 'Copy Link'}
                    </Button>
                  </div>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {result?.success === false && (
          <Alert className="mb-8" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{result.error?.message}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Content Submission
                </CardTitle>
                <CardDescription>
                  Ingest from a URL automatically or write content manually with full Markdown and emoji support.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={mode} onValueChange={(v) => setMode(v as 'url' | 'manual')}>
                  <TabsList className="mb-6">
                    <TabsTrigger value="url" className="gap-2">
                      <Download className="h-4 w-4" />
                      Ingest from URL
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="gap-2">
                      <FileText className="h-4 w-4" />
                      Manual Entry
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="url">
                    <form onSubmit={handleIngestUrl} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="ingest_url" className="flex items-center gap-1.5">
                          <LinkIcon className="h-4 w-4" />
                          URL to Ingest <span className="text-destructive">*</span>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              We fetch content, extract metadata, convert to Markdown, generate SEO tags, emoji summary, and social share cards automatically.
                            </TooltipContent>
                          </Tooltip>
                        </Label>
                        <Input
                          id="ingest_url"
                          type="url"
                          placeholder="https://vanlife.platphormnews.com/guides/solar-setup"
                          value={ingestUrl}
                          onChange={(e) => setIngestUrl(e.target.value)}
                          required
                        />
                      </div>
                      
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="url_category" className="flex items-center gap-1.5">
                            <FolderOpen className="h-4 w-4" />
                            Category
                          </Label>
                          <Select
                            value={formData.category}
                            onValueChange={(value) => setFormData({ ...formData, category: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat.slug} value={cat.slug}>
                                  {cat.icon && <span className="mr-2">{cat.icon}</span>}
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="url_tags" className="flex items-center gap-1.5">
                            <Tag className="h-4 w-4" />
                            Tags
                          </Label>
                          <Input
                            id="url_tags"
                            placeholder="tutorial, beginner, solar"
                            value={formData.tags}
                            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="url_audience" className="flex items-center gap-1.5">
                          <Users className="h-4 w-4" />
                          Target Audience
                        </Label>
                        <Select
                          value={formData.target_audience}
                          onValueChange={(value) => setFormData({ ...formData, target_audience: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Who is this for?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="developers">Developers</SelectItem>
                            <SelectItem value="beginners">Beginners</SelectItem>
                            <SelectItem value="designers">Designers</SelectItem>
                            <SelectItem value="business">Business Users</SelectItem>
                            <SelectItem value="everyone">Everyone</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="auto_publish"
                          checked={autoPublish}
                          onCheckedChange={(checked) => setAutoPublish(checked === true)}
                        />
                        <Label htmlFor="auto_publish" className="text-sm font-normal cursor-pointer">
                          Publish immediately (makes content visible in navigation and docs)
                        </Label>
                      </div>

                      <Button type="submit" className="w-full gap-2" disabled={isIngesting}>
                        {isIngesting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Ingesting...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4" />
                            Ingest Content
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                  
                  <TabsContent value="manual">
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="source_url" className="flex items-center gap-1.5">
                          <Globe className="h-4 w-4" />
                          Source URL <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="source_url"
                          type="url"
                          placeholder="https://vanlife.platphormnews.com/my-blog-post"
                          value={formData.source_url}
                          onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                          required
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="title">
                            Title <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="title"
                            placeholder="Getting Started with Van Life"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="emoji_summary" className="flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4" />
                            Emoji Summary
                          </Label>
                          <Input
                            id="emoji_summary"
                            placeholder="🚐✨🌅"
                            value={formData.emoji_summary}
                            onChange={(e) => setFormData({ ...formData, emoji_summary: e.target.value })}
                            className="text-lg"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="description">
                          Description (for SEO & social cards)
                        </Label>
                        <Textarea
                          id="description"
                          placeholder="A comprehensive guide to starting your van life journey..."
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="min-h-[80px]"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="content">
                            Content (Markdown) <span className="text-destructive">*</span>
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => setShowPreview(!showPreview)}
                          >
                            <Eye className="h-3 w-3" />
                            {showPreview ? 'Edit' : 'Preview'}
                          </Button>
                        </div>
                        
                        {showPreview ? (
                          <div className="min-h-[300px] rounded-lg border p-4">
                            <MarkdownRenderer
                              content={formData.content}
                              className="prose-sm max-w-none"
                            />
                          </div>
                        ) : (
                          <Textarea
                            id="content"
                            placeholder={`# Introduction

Write your content here using Markdown...

## Section 1

- Point one :rocket:
- Point two :star:

Use emoji shortcodes like :smile: or Unicode directly! 🎉`}
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            required
                            className="min-h-[300px] font-mono text-sm"
                          />
                        )}
                        <p className="text-xs text-muted-foreground">
                          Supports full Markdown with GFM extensions. Emoji shortcodes like :rocket: work too!
                        </p>
                      </div>
                      
                      <Separator />
                      
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="manual_category" className="flex items-center gap-1.5">
                            <FolderOpen className="h-4 w-4" />
                            Category
                          </Label>
                          <Select
                            value={formData.category}
                            onValueChange={(value) => setFormData({ ...formData, category: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat.slug} value={cat.slug}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="manual_tags" className="flex items-center gap-1.5">
                            <Tag className="h-4 w-4" />
                            Tags
                          </Label>
                          <Input
                            id="manual_tags"
                            placeholder="tutorial, beginner"
                            value={formData.tags}
                            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="manual_audience" className="flex items-center gap-1.5">
                          <Users className="h-4 w-4" />
                          Target Audience
                        </Label>
                        <Select
                          value={formData.target_audience}
                          onValueChange={(value) => setFormData({ ...formData, target_audience: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Who is this content for?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="developers">Developers</SelectItem>
                            <SelectItem value="beginners">Beginners</SelectItem>
                            <SelectItem value="designers">Designers</SelectItem>
                            <SelectItem value="business">Business Users</SelectItem>
                            <SelectItem value="everyone">Everyone</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="author_name" className="flex items-center gap-1.5">
                            <User className="h-4 w-4" />
                            Author Name
                          </Label>
                          <Input
                            id="author_name"
                            placeholder="Jane Doe"
                            value={formData.author_name}
                            onChange={(e) => setFormData({ ...formData, author_name: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="author_email" className="flex items-center gap-1.5">
                            <Mail className="h-4 w-4" />
                            Author Email
                          </Label>
                          <Input
                            id="author_email"
                            type="email"
                            placeholder="jane@example.com"
                            value={formData.author_email}
                            onChange={(e) => setFormData({ ...formData, author_email: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button type="submit" className="flex-1 gap-2" disabled={isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4" />
                              Submit for Review
                            </>
                          )}
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={saveDraft}
                          disabled={isSavingDraft}
                          className="gap-1"
                        >
                          {isSavingDraft ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Save Draft
                        </Button>
                      </div>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Auto-Generated
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <span className="font-medium">SEO Meta Tags</span>
                    <p className="text-muted-foreground">OG title, description, image</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <span className="font-medium">Social Cards</span>
                    <p className="text-muted-foreground">Twitter, LinkedIn, Facebook</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <span className="font-medium">Emoji Summary</span>
                    <p className="text-muted-foreground">Auto-detected from content</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <span className="font-medium">Reading Time</span>
                    <p className="text-muted-foreground">Word count & time estimate</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <span className="font-medium">Search Index</span>
                    <p className="text-muted-foreground">Full-text search ready</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Session Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {session ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fingerprint</span>
                      <code className="font-mono text-xs">{session.fingerprint}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Locale</span>
                      <span>{session.locale}</span>
                    </div>
                    {session.geo?.city && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Location</span>
                        <span>{session.geo.city}, {session.geo.region}</span>
                      </div>
                    )}
                    {lastSaved && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Saved</span>
                        <span>{lastSaved.toLocaleTimeString()}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">Loading session...</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>MCP Integration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Use MCP tools for automated submission:
                </p>
                <div className="rounded-lg bg-muted p-3 font-mono text-xs overflow-x-auto">
                  <pre>{`// submit_content
{
  "source_url": "...",
  "title": "...",
  "content": "...",
  "tags": ["tag1"],
  "category": "guides"
}`}</pre>
                </div>
                <Link href="/docs/mcp" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                  View MCP Documentation
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </DocsLayout>
    </TooltipProvider>
  )
}
