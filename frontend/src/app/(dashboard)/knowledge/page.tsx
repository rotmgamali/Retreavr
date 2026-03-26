'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  BookOpen,
  Upload,
  Search,
  Trash2,
  FileText,
  Loader2,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TablePagination,
} from '@/components/ui/table'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import { staggerContainer, staggerItem } from '@/lib/motion'
import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
  useRetrieveKnowledge,
} from '@/hooks/use-knowledge'

const PAGE_SIZE = 10

function statusVariant(status: string) {
  switch (status) {
    case 'ready':
      return 'success' as const
    case 'processing':
      return 'warning' as const
    case 'failed':
      return 'destructive' as const
    default:
      return 'secondary' as const
  }
}

export default function KnowledgePage() {
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const offset = (page - 1) * PAGE_SIZE
  const { data, isLoading, isError, refetch } = useDocuments({
    limit: PAGE_SIZE,
    offset,
  })
  const uploadMutation = useUploadDocument()
  const deleteMutation = useDeleteDocument()
  const retrieveMutation = useRetrieveKnowledge()

  const handleUpload = async () => {
    if (!uploadTitle.trim()) {
      toast.error('Please enter a document title')
      return
    }
    if (!uploadFile) {
      toast.error('Please select a file')
      return
    }
    try {
      await uploadMutation.mutateAsync({ title: uploadTitle.trim(), file: uploadFile })
      toast.success('Document uploaded successfully')
      setUploadOpen(false)
      setUploadTitle('')
      setUploadFile(null)
    } catch {
      toast.error('Failed to upload document')
    }
  }

  const handleDelete = async (id: string, title: string) => {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success(`Deleted "${title}"`)
    } catch {
      toast.error('Failed to delete document')
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearchActive(true)
    try {
      await retrieveMutation.mutateAsync({ query: searchQuery.trim(), top_k: 5 })
    } catch {
      toast.error('Search failed')
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setIsSearchActive(false)
    retrieveMutation.reset()
  }

  const documents = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground mt-1">
            Upload and manage documents for AI-powered semantic search
          </p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Upload a document to the knowledge base. Supported formats: PDF, TXT, Markdown, CSV.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Enter document title..."
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">File</label>
                <div
                  className="flex items-center gap-3 rounded-lg border border-dashed border-white/20 bg-white/5 p-4 cursor-pointer hover:border-white/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    {uploadFile ? (
                      <p className="text-sm font-medium truncate">{uploadFile.name}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Click to select a file (.pdf, .txt, .md, .csv)
                      </p>
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.csv"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setUploadOpen(false)}
                disabled={uploadMutation.isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={uploadMutation.isPending}>
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Search Bar */}
      <motion.div variants={staggerItem}>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Semantic search across all documents..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              {isSearchActive && (
                <Button variant="ghost" size="icon" onClick={clearSearch}>
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Button onClick={handleSearch} disabled={retrieveMutation.isPending || !searchQuery.trim()}>
                {retrieveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Search'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Search Results */}
      {isSearchActive && retrieveMutation.data && (
        <motion.div variants={staggerItem}>
          <Card className="glass-card border-blue-500/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-400" />
                Search Results
                <Badge variant="secondary" className="ml-2">
                  {retrieveMutation.data.results.length} matches
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {retrieveMutation.data.results.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No results found"
                  description="Try a different search query."
                />
              ) : (
                retrieveMutation.data.results.map((result, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-400">
                        {result.document_title}
                      </span>
                      <Badge variant="outline" className="text-xs tabular-nums">
                        {(result.score * 100).toFixed(1)}% relevance
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {result.chunk_text}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Document Table */}
      <motion.div variants={staggerItem}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-400" />
              Documents
              {total > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {total}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6">
                <LoadingState variant="skeleton-table" count={5} />
              </div>
            ) : isError ? (
              <div className="p-6">
                <ErrorState
                  title="Failed to load documents"
                  onRetry={() => refetch()}
                />
              </div>
            ) : documents.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={BookOpen}
                  title="No documents yet"
                  description="Upload your first document to get started with the knowledge base."
                  actionLabel="Upload Document"
                  onAction={() => setUploadOpen(true)}
                />
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Chunks</TableHead>
                      <TableHead>File Type</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.title}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(doc.status)} className="capitalize text-xs">
                            {doc.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums text-slate-300">
                          {doc.total_chunks}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs uppercase">
                            {doc.file_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-400"
                            onClick={() => handleDelete(doc.id, doc.title)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={total}
                  onPageChange={setPage}
                />
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
