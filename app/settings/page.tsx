"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Settings, 
  Save, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Globe, 
  Lock, 
  ExternalLink,
  Github,
  Calendar,
  Layout,
  FileJson,
  FileCode,
  Smile,
  Image,
  Radio,
  Home,
  Info,
  Copy
} from 'lucide-react'
import { locales, localeNames, type Locale } from '@/lib/i18n'

interface Integration {
  id: string
  name: string
  base_url: string
  api_path: string
  mcp_path: string
  enabled: boolean
  settings: Record<string, unknown>
}

interface SettingsData {
  auto_approve_submissions: boolean
  base_url: string
  default_locale: string
  site_name: string
  github_repo: string
  password_is_set: boolean
}

const integrationIcons: Record<string, React.ReactNode> = {
  mcp_hub: <Globe className="h-4 w-4" />,
  platphorm_news: <Home className="h-4 w-4" />,
  emoji: <Smile className="h-4 w-4" />,
  svg: <Image className="h-4 w-4" />,
  json: <FileJson className="h-4 w-4" />,
  xml: <FileCode className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />,
  kanban: <Layout className="h-4 w-4" />,
}

const integrationDescriptions: Record<string, string> = {
  mcp_hub: 'Central MCP registry and discovery service',
  platphorm_news: 'Main Platphorm News content platform',
  emoji: 'Emoji service for rich content',
  svg: 'SVG generation and management',
  json: 'JSON data services',
  xml: 'XML transformation services',
  calendar: 'Calendar and scheduling MCP host',
  kanban: 'Kanban project management MCP host',
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [defaults, setDefaults] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [adminPassword, setAdminPassword] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  
  useEffect(() => {
    fetchSettings()
  }, [])
  
  async function fetchSettings() {
    try {
      const res = await fetch('/api/v1/settings')
      const data = await res.json()
      if (data.success) {
        setSettings(data.data?.settings || null)
        setIntegrations(Array.isArray(data.data?.integrations) ? data.data.integrations : [])
        setDefaults(data.data?.defaults || {})
      }
    } catch (err) {
      console.error('Error fetching settings:', err)
      setError('Failed to load settings')
      setIntegrations([])
    } finally {
      setLoading(false)
    }
  }
  
  function checkHasChanges(newSettings: SettingsData) {
    if (!defaults) return false
    return Object.entries(newSettings).some(([key, value]) => {
      if (key === 'password_is_set') return false
      return JSON.stringify(value) !== JSON.stringify(defaults[key])
    })
  }
  
  function updateSetting<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
    if (!settings) return
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    setHasChanges(checkHasChanges(newSettings))
  }
  
  function updateIntegration(id: string, updates: Partial<Integration>) {
    setIntegrations(prev => 
      prev.map(i => i.id === id ? { ...i, ...updates } : i)
    )
    setHasChanges(true)
  }
  
  async function handleSave() {
    if (!settings) return
    
    // Check password confirmation
    if (newAdminPassword && newAdminPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    setSaving(true)
    setSaveStatus('idle')
    setError(null)
    
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings,
          integrations,
          admin_password: adminPassword || undefined,
          new_admin_password: newAdminPassword || undefined,
        }),
      })
      
      const data = await res.json()
      
      if (data.success) {
        setSaveStatus('success')
        setHasChanges(false)
        setAdminPassword('')
        setNewAdminPassword('')
        setConfirmPassword('')
        // Refresh settings to get updated password_is_set
        fetchSettings()
      } else {
        setSaveStatus('error')
        setError(data.error || 'Failed to save settings')
      }
    } catch (err) {
      console.error('Error saving settings:', err)
      setSaveStatus('error')
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }
  
  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
  }
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  
  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 font-semibold">
                <Globe className="h-5 w-5 text-primary" />
                <span>{settings?.site_name || 'OpenDocs'}</span>
              </Link>
              <Badge variant="secondary">Settings</Badge>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" asChild>
                <Link href="/docs">Back to Docs</Link>
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={saving || !hasChanges}
                size="sm"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : saveStatus === 'success' ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </div>
        </header>
        
        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Settings className="h-8 w-8" />
              Settings
            </h1>
            <p className="mt-2 text-muted-foreground">
              Configure your OpenDocs instance. Clone and redeploy to Vercel with your own integrations.
            </p>
          </div>
          
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
          )}
          
          {/* Clone Repo Banner */}
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3">
                <Github className="h-6 w-6" />
                <div>
                  <p className="font-medium">Want your own instance?</p>
                  <p className="text-sm text-muted-foreground">Clone the repo and deploy to Vercel in minutes</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={settings?.github_repo || 'https://github.com/platphormnews/opendocs'} target="_blank" rel="noopener noreferrer">
                    <Github className="mr-2 h-4 w-4" />
                    Clone Repository
                  </a>
                </Button>
                <Button size="sm" asChild>
                  <a href={`https://vercel.com/new/clone?repository-url=${encodeURIComponent(settings?.github_repo || 'https://github.com/platphormnews/opendocs')}`} target="_blank" rel="noopener noreferrer">
                    Deploy to Vercel
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
              <TabsTrigger value="documentation">Documentation</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>
            
            {/* General Tab */}
            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Site Configuration</CardTitle>
                  <CardDescription>Basic settings for your documentation site</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="site_name">Site Name</Label>
                      <Input
                        id="site_name"
                        value={settings?.site_name || ''}
                        onChange={(e) => updateSetting('site_name', e.target.value)}
                        placeholder="OpenDocs"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="base_url" className="flex items-center gap-2">
                        Base URL
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Used in API examples and sitemap generation
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <Input
                        id="base_url"
                        value={settings?.base_url || ''}
                        onChange={(e) => updateSetting('base_url', e.target.value)}
                        placeholder="https://docs.platphormnews.com"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="github_repo">GitHub Repository</Label>
                      <Input
                        id="github_repo"
                        value={settings?.github_repo || ''}
                        onChange={(e) => updateSetting('github_repo', e.target.value)}
                        placeholder="https://github.com/platphormnews/opendocs"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="default_locale">Default Language</Label>
                      <Select
                        value={settings?.default_locale || 'en'}
                        onValueChange={(value) => updateSetting('default_locale', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {locales.map((locale) => (
                            <SelectItem key={locale} value={locale}>
                              {localeNames[locale as Locale]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Content Moderation</CardTitle>
                  <CardDescription>Configure how submitted content is handled</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto_approve" className="text-base">Auto-Approve Submissions</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically publish submitted content without manual review
                      </p>
                    </div>
                    <Switch
                      id="auto_approve"
                      checked={settings?.auto_approve_submissions || false}
                      onCheckedChange={(checked) => updateSetting('auto_approve_submissions', checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Integrations Tab */}
            <TabsContent value="integrations" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Platphorm News Ecosystem</CardTitle>
                  <CardDescription>
                    Connect with other MCP-enabled services. These default to Platphorm News services but can be changed to your own deployments.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {integrations.map((integration) => (
                    <div key={integration.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            {integrationIcons[integration.name] || <Globe className="h-5 w-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium capitalize">{integration.name.replace(/_/g, ' ')}</h4>
                              {integration.enabled && (
                                <Badge variant="secondary" className="text-xs">Active</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {integrationDescriptions[integration.name] || 'External service integration'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center">
                                <Radio className="h-4 w-4 mr-2 text-muted-foreground" />
                                <Switch
                                  checked={integration.enabled}
                                  onCheckedChange={(checked) => updateIntegration(integration.id, { enabled: checked })}
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {integration.enabled ? 'Click to disable' : 'Click to enable'}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      
                      {integration.enabled && (
                        <div className="mt-4 grid gap-4 sm:grid-cols-3">
                          <div className="space-y-2">
                            <Label className="text-xs">Base URL</Label>
                            <div className="flex gap-2">
                              <Input
                                value={integration.base_url}
                                onChange={(e) => updateIntegration(integration.id, { base_url: e.target.value })}
                                className="text-sm"
                              />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="icon"
                                    onClick={() => copyToClipboard(integration.base_url)}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy URL</TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">API Path</Label>
                            <Input
                              value={integration.api_path}
                              onChange={(e) => updateIntegration(integration.id, { api_path: e.target.value })}
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">MCP Path</Label>
                            <Input
                              value={integration.mcp_path}
                              onChange={(e) => updateIntegration(integration.id, { mcp_path: e.target.value })}
                              className="text-sm"
                            />
                          </div>
                        </div>
                      )}
                      
                      {integration.enabled && (
                        <div className="mt-3 flex gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <a href={`${integration.base_url}${integration.api_path}/docs`} target="_blank" rel="noopener noreferrer">
                              API Docs
                              <ExternalLink className="ml-2 h-3 w-3" />
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <a href={`${integration.base_url}${integration.mcp_path}`} target="_blank" rel="noopener noreferrer">
                              MCP Endpoint
                              <ExternalLink className="ml-2 h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Documentation Tab */}
            <TabsContent value="documentation" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Documentation Visibility</CardTitle>
                  <CardDescription>
                    Toggle which documentation files are exposed via the API. Disabled docs will return 404.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      { key: 'readme', label: 'README', desc: 'Project overview' },
                      { key: 'architecture', label: 'Architecture', desc: 'System design' },
                      { key: 'api', label: 'API Reference', desc: 'REST & MCP docs' },
                      { key: 'features', label: 'Features', desc: 'Capabilities' },
                      { key: 'standards', label: 'Standards', desc: 'Compliance info' },
                      { key: 'ecosystem', label: 'Ecosystem', desc: 'Platphorm services' },
                      { key: 'integrations', label: 'Integrations', desc: 'Third-party guides' },
                      { key: 'use_cases', label: 'Use Cases', desc: 'Deployment scenarios' },
                      { key: 'roadmap', label: 'Roadmap', desc: 'Release plans' },
                      { key: 'testing', label: 'Testing', desc: 'Test strategy' },
                      { key: 'contributing', label: 'Contributing', desc: 'Contribution guide' },
                      { key: 'changelog', label: 'Changelog', desc: 'Version history' },
                      { key: 'security', label: 'Security', desc: 'Security policy' },
                      { key: 'support', label: 'Support', desc: 'Funding & help' },
                      { key: 'logging', label: 'Logging', desc: 'Logging standards' },
                      { key: 'version', label: 'Version', desc: 'Version info' },
                    ].map((doc) => (
                      <div key={doc.key} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium">{doc.label}</p>
                          <p className="text-xs text-muted-foreground">{doc.desc}</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>API Endpoints</CardTitle>
                  <CardDescription>Documentation API routes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <code className="block rounded bg-muted p-2 text-sm">
                    GET /api/v1/docs - List all documentation
                  </code>
                  <code className="block rounded bg-muted p-2 text-sm">
                    GET /api/v1/docs/:slug - Get specific doc
                  </code>
                  <code className="block rounded bg-muted p-2 text-sm">
                    GET /api/v1/version - Version info
                  </code>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Security Tab */}
            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Admin Password
                  </CardTitle>
                  <CardDescription>
                    Set an admin password to protect settings changes. Once set, the password is required to save any modifications to default values.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {settings?.password_is_set && (
                    <div className="space-y-2">
                      <Label htmlFor="current_password">Current Password</Label>
                      <Input
                        id="current_password"
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Enter current password to save changes"
                      />
                      <p className="text-xs text-muted-foreground">
                        Required to save changes when default values are modified
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="new_password">
                      {settings?.password_is_set ? 'New Password (optional)' : 'Set Admin Password'}
                    </Label>
                    <Input
                      id="new_password"
                      type="password"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      placeholder={settings?.password_is_set ? 'Leave empty to keep current' : 'Enter admin password'}
                    />
                  </div>
                  
                  {newAdminPassword && (
                    <div className="space-y-2">
                      <Label htmlFor="confirm_password">Confirm Password</Label>
                      <Input
                        id="confirm_password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                      />
                      {newAdminPassword !== confirmPassword && confirmPassword && (
                        <p className="text-xs text-destructive">Passwords do not match</p>
                      )}
                    </div>
                  )}
                  
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-sm">
                      <strong>Note:</strong> The admin password protects the settings page only. 
                      API endpoints use API key authentication.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          {/* Save Button (sticky at bottom on mobile) */}
          <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4 sm:hidden">
            <Button 
              onClick={handleSave} 
              disabled={saving || !hasChanges}
              className="w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}
