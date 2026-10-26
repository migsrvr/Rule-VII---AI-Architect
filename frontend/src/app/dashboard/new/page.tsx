"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Scale, ArrowLeft, X, Menu, Plus, Loader2, Trash2, MoreHorizontal, Star, Search, FolderOpen, RefreshCw, Check } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup
} from "@/components/ui/resizable";

// API Client
import { apiClient, API_URL } from "@/lib/api-client";
import { ChatResponse, ChatHistoryItem } from "@/lib/api-types";
import { supabase } from "@/lib/supabase";

// Import components
import DocumentPanel from "@/components/workspace/DocumentPanel";
import DraftBubble from "@/components/workspace/DraftBubble";
import MessageBubble from "@/components/chat/MessageBubble";
import InputArea, { ChatMode } from "@/components/chat/InputArea";
import ThoughtStream from "@/components/chat/ThoughtStream";
import RevisionModal from "@/components/workspace/RevisionModal";

import RevisionProposalMessage from "@/components/workspace/RevisionProposalMessage";

// Import Types
import { DocumentSection, DraftProposal, WorkspaceMessage } from "@/types/workspace";
import { RevisionProposal } from "@/types/revision";

function WorkspacePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Core State
    const [sections, setSections] = useState<DocumentSection[]>([]);
    const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
    const [conversationId, setConversationId] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(false);

    // Chat Mode State (persists until user changes it)
    const [chatMode, setChatMode] = useState<ChatMode>("quick_answer");

    // Reply Context State (for Facebook-style reply card)
    const [replyingTo, setReplyingTo] = useState<{ content: string; preview: string } | null>(null);

    // Project Context State
    const [projectContext, setProjectContext] = useState<{
        id: string;
        name: string;
        location?: string;
        description?: string;
        fileCount: number;
    } | null>(null);

    const [isLoadingProject, setIsLoadingProject] = useState(false);

    // History State
    const [history, setHistory] = useState<ChatHistoryItem[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

    // Feature States for Edit/Revise
    const [inputOverride, setInputOverride] = useState("");
    const [editingSection, setEditingSection] = useState<DocumentSection | null>(null);
    const [editForm, setEditForm] = useState({ title: "", content: "" });
    const [revisingSection, setRevisingSection] = useState<DocumentSection | null>(null);
    const [revisionModalOpen, setRevisionModalOpen] = useState(false);
    const [isRevisionLoading, setIsRevisionLoading] = useState(false);
    const [revisionProposals, setRevisionProposals] = useState<RevisionProposal[]>([]);

    // Thought Stream State (simplified)
    const [thoughtSteps] = useState<string[]>(["Searching", "Analyzing", "Generating"]);
    const [isThoughtComplete, setIsThoughtComplete] = useState(false);
    const [showThoughtStream, setShowThoughtStream] = useState(false);

    // Auto-scroll logic
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, revisionProposals]);

    // Load project context if project param exists
    useEffect(() => {
        const projectId = searchParams.get('project');
        if (projectId) {
            loadProjectContext(projectId);
        }
    }, [searchParams]);

    // Load history on mount
    useEffect(() => {
        loadHistory();
    }, []);

    const loadProjectContext = async (projectId: string) => {
        setIsLoadingProject(true);
        try {
            // 1. Check for existing session for this project
            const sessionRes = await fetch(`${API_URL}/api/v1/chat/project/${projectId}/session`, {
                headers: { "Authorization": `Bearer ${await getToken()}` }
            });
            const sessionData = await sessionRes.json();

            if (sessionData.conversation_id) {
                // Load existing conversation
                await handleSelectConversation(sessionData.conversation_id);
            }

            // 2. Fetch project details
            const projectRes = await fetch(`${API_URL}/api/v1/projects/`, {
                headers: { "Authorization": `Bearer ${await getToken()}` }
            });
            const projects = await projectRes.json();
            const project = projects.find((p: any) => p.id === projectId);

            if (project) {
                // 3. Fetch file count
                const filesRes = await fetch(`${API_URL}/api/v1/projects/${projectId}/files`, {
                    headers: { "Authorization": `Bearer ${await getToken()}` }
                });
                const files = await filesRes.json();

                setProjectContext({
                    id: projectId,
                    name: project.name,
                    location: project.location,
                    description: project.description,
                    fileCount: files.length || 0
                });
            }
        } catch (error) {
            console.error("Error loading project context:", error);
        } finally {
            setIsLoadingProject(false);
        }
    };

    // Helper to get auth token using shared supabase client
    const getToken = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token || '';
    };

    const loadHistory = async () => {
        try {
            // @ts-ignore
            const data = await apiClient.chat.getHistory();
            setHistory(data);
        } catch (e) {
            console.error("Failed to load history", e);
        }
    };

    const handleSelectConversation = async (id: string) => {
        setConversationId(id);
        setIsHistoryOpen(false);
        setIsLoading(true);
        try {
            // @ts-ignore
            const msgs = await apiClient.chat.getConversation(id);
            setMessages(msgs.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                timestamp: new Date(m.created_at),
                proposal: m.proposal ? {
                    id: m.proposal.id || `prop-${m.id}`,
                    title: m.proposal.title,
                    summary: m.proposal.summary,
                    reasoning: m.proposal.reasoning,
                    proposedContent: m.proposal.proposedContent || m.proposal.proposed_content || ""
                } : undefined
            })));
        } catch (e) {
            console.error(e);
        }

        // Fetch Saved Proposals for this conversation
        try {
            // @ts-ignore
            const savedProps = await apiClient.chat.getSavedProposals(id);
            const savedSections: DocumentSection[] = savedProps.map((p: any) => ({
                id: p.id || `saved-${Date.now()}`,
                title: p.title,
                content: p.content,
                status: 'approved',
                lastUpdated: new Date(p.created_at || Date.now())
            }));
            setSections(savedSections);
        } catch (err) {
            console.error("Failed to fetch proposals", err);
            setSections([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNewChat = () => {
        setConversationId(undefined);
        setMessages([]);
        setSections([]);
        setIsHistoryOpen(false);
    };

    const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering the select
        setOpenMenuId(null);

        if (!confirm("Delete this conversation? This cannot be undone.")) return;

        // Optimistic update - remove from list
        setHistory(prev => prev.filter(h => h.id !== id));

        // If we're viewing this conversation, clear it
        if (conversationId === id) {
            setConversationId(undefined);
            setMessages([]);
            setSections([]);
        }

        try {
            await apiClient.chat.deleteConversation(id);
        } catch (error) {
            console.error("Failed to delete conversation:", error);
            const freshHistory = await apiClient.chat.getHistory();
            setHistory(freshHistory);
        }
    };

    const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenMenuId(null);

        try {
            // @ts-ignore
            const result = await apiClient.chat.toggleFavorite(id);

            // Update local state
            setHistory(prev => {
                const updated = prev.map(h =>
                    h.id === id ? { ...h, is_favorite: result.is_favorite } : h
                );
                return updated.sort((a, b) => {
                    if (a.is_favorite && !b.is_favorite) return -1;
                    if (!a.is_favorite && b.is_favorite) return 1;
                    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
                });
            });
        } catch (error) {
            console.error("Failed to toggle favorite:", error);
        }
    };

    // --- ACTIONS FOR DOCUMENT PANEL ---
    const handleDeleteSection = async (id: string) => {
        if (!confirm("Delete this section?")) return;

        // Optimistic update
        setSections(prev => prev.filter(s => s.id !== id));

        // Call backend
        try {
            // @ts-ignore
            await apiClient.chat.deleteProposal(id);
        } catch (error) {
            console.error("Failed to delete:", error);
        }
    };

    // ===== REVISION WORKFLOW HANDLERS =====

    // Open revision modal
    const handleReviseSection = (section: DocumentSection) => {
        setRevisingSection(section);
        setRevisionModalOpen(true);
    };

    // Submit revision request from modal
    const handleSubmitRevision = async (instructions: string) => {
        if (!revisingSection) return;

        try {
            setIsRevisionLoading(true);

            const revisionPrompt = `You are an expert architectural compliance reviewer. The user wants to modify a section of their document.

SECTION TITLE: "${revisingSection.title}"

WHAT THE USER WANTS TO ADD/CHANGE:
${instructions}

CONTEXT (the current content for reference only, do NOT repeat this):
${revisingSection.content}

YOUR TASK:
Based on the user's instructions, provide ONLY the NEW or MODIFIED content they requested. 

FORMATTING RULES:
- Do NOT repeat or summarize what's already in the current content
- ONLY provide the additions or changes the user asked for
- Use proper paragraph spacing with line breaks between sections
- Be specific with code references and standards where applicable
- If the user asks for a TABLE, format it using markdown table syntax:
  | Header 1 | Header 2 | Header 3 |
  |----------|----------|----------|
  | Data 1   | Data 2   | Data 3   |
- If the user asks for a LIST, use clean numbered or bulleted lists
- Use **bold** for emphasis on important terms or code references
- Include source references in [brackets] where applicable

Provide only the new/revised content:`;

            const token = await getToken();
            const response = await fetch(`${API_URL}/api/v1/chat/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: revisionPrompt,
                    conversation_id: conversationId,
                    project_id: projectContext?.id
                })
            });

            if (!response.ok) throw new Error('Failed to get AI revision');

            const data = await response.json();

            // Add as a regular assistant message with revision data attached
            const revisionMessage: WorkspaceMessage = {
                id: Date.now().toString(),
                role: 'assistant',
                content: data.response,
                timestamp: new Date(),
                // Include revision data for approve/reject actions
                revisionData: {
                    sectionId: revisingSection.id,
                    sectionTitle: revisingSection.title,
                    userInstructions: instructions,
                    status: 'pending' as const
                }
            };

            setMessages(prev => [...prev, revisionMessage]);
            setRevisionModalOpen(false);
            setRevisingSection(null);

        } catch (error) {
            console.error('Error revising section:', error);
            alert('Failed to get AI revision. Please try again.');
        } finally {
            setIsRevisionLoading(false);
        }
    };

    // Approve revision and APPEND to section (not replace)
    const handleApproveRevision = (sectionId: string, newContent: string) => {
        // Append the new content to existing section
        setSections(prev => prev.map(s =>
            s.id === sectionId
                ? {
                    ...s,
                    content: s.content + '\n\n' + newContent,
                    lastUpdated: new Date()
                }
                : s
        ));
        // Update message status to approved
        setMessages(prev => prev.map(m =>
            m.revisionData?.sectionId === sectionId
                ? { ...m, revisionData: { ...m.revisionData, status: 'approved' as const } }
                : m
        ));
    };

    // Revise again - reopen modal
    const handleReviseAgain = (sectionId: string) => {
        const section = sections.find(s => s.id === sectionId);
        if (section) {
            setRevisingSection(section);
            setRevisionModalOpen(true);
        }
    };

    // Reject revision
    const handleRejectRevision = (messageId: string) => {
        setMessages(prev => prev.map(m =>
            m.id === messageId && m.revisionData
                ? { ...m, revisionData: { ...m.revisionData, status: 'rejected' as const } }
                : m
        ));
    };

    // ===== END REVISION WORKFLOW =====

    // STEP 1: Simplified Manual Edit Handler
    const handleEditSection = (section: DocumentSection) => {
        setEditingSection(section);
        setEditForm({ title: section.title, content: section.content });
    };

    const saveSectionEdit = async () => {
        if (!editingSection) return;

        // Optimistic update
        setSections(prev => prev.map(s => s.id === editingSection.id ? {
            ...s,
            title: editForm.title,
            content: editForm.content,
            lastUpdated: new Date()
        } : s));

        // Call backend
        try {
            // @ts-ignore
            await apiClient.chat.updateProposal(editingSection.id, {
                title: editForm.title,
                summary: "", // Keep existing or update
                content: editForm.content
            });
        } catch (error) {
            console.error("Failed to update:", error);
        }

        setEditingSection(null);
    };

    const handleEditPrompt = (content: string) => {
        setInputOverride(content);
    };

    // Reply to specific AI message (Facebook-style card)
    const handleReplyToMessage = (originalContent: string) => {
        const preview = originalContent.slice(0, 80).replace(/\n/g, ' ').replace(/#+\s*/g, '');
        setReplyingTo({
            content: originalContent,
            preview: preview + (originalContent.length > 80 ? '...' : '')
        });
    };

    const handleCancelReply = () => {
        setReplyingTo(null);
    };

    // Add AI response directly to draft (simple version without proposal structure)
    const handleAddToDraft = async (content: string) => {
        const newSection: DocumentSection = {
            id: `draft-${Date.now()}`,
            title: "AI Response",
            content: content,
            status: "approved",
            lastUpdated: new Date()
        };

        setSections(prev => [newSection, ...prev]);

        // Save to backend if we have a conversation
        if (conversationId) {
            try {
                const payload = {
                    conversation_id: conversationId,
                    title: "AI Response",
                    summary: content.slice(0, 100) + "...",
                    content: content
                };
                // @ts-ignore
                const savedProposal = await apiClient.chat.saveProposal(payload);
                if (savedProposal?.id) {
                    setSections(prev => prev.map(s =>
                        s.id === newSection.id ? { ...s, id: savedProposal.id } : s
                    ));
                }
            } catch (error) {
                console.error("Error saving draft:", error);
            }
        }
    };

    // --- THOUGHT STREAM HELPERS ---
    const initializeThoughtStream = useCallback(() => {
        setIsThoughtComplete(false);
        setShowThoughtStream(true);
    }, []);

    // --- MAIN SEND MESSAGE WITH BACKEND ---
    const handleSendMessage = async (inputContent: string, files: File[], mode: ChatMode) => {
        setChatMode(mode); // Update persistent mode state
        setInputOverride(""); // Clear override

        // Capture reply context
        const replyContext = replyingTo?.content;
        const replyPreview = replyingTo?.preview;
        setReplyingTo(null); // Clear reply stateUi

        // Display content (what user sees) - includes the quote
        let displayContent = inputContent;
        if (replyPreview) {
            displayContent = `[Replying to: "${replyPreview}"]\n\n${inputContent}`;
        }

        // Search content (what RAG uses) - JUST the input
        // LLM will get replyContext passed separately

        if (!inputContent && files.length === 0) return;

        const requestStartTime = Date.now(); // Track for minimum thinking time

        // 1. Optimistic UI: Add user message immediately
        const userMsg: WorkspaceMessage = {
            id: Date.now().toString(),
            role: "user",
            content: displayContent || (files.length > 0 ? `Uploaded: ${files.map(f => f.name).join(', ')}` : ""),
            timestamp: new Date(),
            attachment: files.length > 0 ? {
                name: files[0].name,  // Show first file in attachment
                type: files[0].type,
                size: files[0].size,
                url: URL.createObjectURL(files[0])
            } : undefined
        };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        // Initialize thought stream
        initializeThoughtStream();

        try {
            let data: ChatResponse;

            if (files.length > 0) {
                // For now, upload only the first file (analyze endpoint supports 1 file)
                data = await apiClient.analyze.upload(files[0], inputContent);
            } else {
                // 2. Call Backend
                data = await apiClient.chat.send({
                    message: inputContent,
                    reply_context: replyContext, // Send full original message as context
                    conversation_id: conversationId,
                    project_id: projectContext?.id,
                    mode,  // Include chat mode for RAG filtering
                });
            }

            if (data && data.conversation_id) {
                setConversationId(data.conversation_id);

                // If this is a new conversation, add it to history immediately
                if (!conversationId) {
                    const newHistoryItem: ChatHistoryItem = {
                        id: data.conversation_id,
                        title: inputContent.slice(0, 60) + (inputContent.length > 60 ? "..." : ""),
                        updated_at: new Date().toISOString(),
                        is_favorite: false
                    };
                    setHistory(prev => [newHistoryItem, ...prev]);
                }
            }

            // Minimum delay for thought stream animation (4 seconds total)
            const MINIMUM_THINKING_TIME = 4000;
            const elapsedTime = Date.now() - requestStartTime;
            const remainingDelay = Math.max(0, MINIMUM_THINKING_TIME - elapsedTime);

            await new Promise(resolve => setTimeout(resolve, remainingDelay));

            // Hide thought stream after animation completes
            setShowThoughtStream(false);

            const aiMsg: WorkspaceMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: data?.response || "File uploaded successfully. How can I help you with this?",
                timestamp: new Date(),
                sources: data?.sources || [],  // Store the actual RAG sources
                proposal: data?.proposal ? {
                    id: `prop-${Date.now()}`,
                    title: data.proposal.title || "Draft Proposal",
                    summary: data.proposal.summary || "Generated from analysis",
                    reasoning: data.proposal.reasoning || "",
                    proposedContent: data.proposal.proposed_content || data.proposal.proposedContent || ""
                } : undefined
            };

            setMessages(prev => [...prev, aiMsg]);

        } catch (error: any) {
            console.error("Workspace Chat Error:", error);
            setShowThoughtStream(false);
            const errorMsg: WorkspaceMessage = {
                id: (Date.now() + 2).toString(),
                role: "system",
                content: "⚠️ " + (error.response?.data?.detail || "Connection failed. Please check your login status."),
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApproveDraft = async (proposal: DraftProposal) => {
        if (!conversationId) {
            alert("No active conversation found to save this proposal to.");
            return;
        }

        const newSection: DocumentSection = {
            id: proposal.id,
            title: proposal.title,
            content: proposal.proposedContent,
            status: "approved",
            lastUpdated: new Date()
        };

        // Check if we're in revision mode (updating an existing section)
        if (revisingSection) {
            // UPDATE existing section
            setSections(prev => prev.map(s =>
                s.id === revisingSection.id ? {
                    ...s,
                    title: proposal.title,
                    content: proposal.proposedContent,
                    lastUpdated: new Date()
                } : s
            ));

            // Update in backend
            try {
                // @ts-ignore
                await apiClient.chat.updateProposal(revisingSection.id, {
                    title: proposal.title,
                    summary: proposal.summary,
                    content: proposal.proposedContent || ""
                });
            } catch (error) {
                console.error("Error updating proposal:", error);
            }

            setRevisingSection(null); // Clear revision mode
        } else {
            // ADD new section (original behavior)
            setSections(prev => {
                if (prev.some(s => s.id === proposal.id)) return prev;
                return [newSection, ...prev];
            });

            try {
                const payload = {
                    conversation_id: conversationId,
                    title: proposal.title,
                    summary: proposal.summary,
                    content: proposal.proposedContent || proposal.reasoning || ""
                };
                // @ts-ignore
                const savedProposal = await apiClient.chat.saveProposal(payload);

                // Update the section ID with the backend-generated ID
                if (savedProposal?.id) {
                    setSections(prev => prev.map(s =>
                        s.id === proposal.id ? { ...s, id: savedProposal.id } : s
                    ));
                }
            } catch (error) {
                console.error("Error saving proposal:", error);
            }
        }
    };

    const handleRejectDraft = (id: string) => {
        console.log("Rejected:", id);
        setRevisingSection(null); // Clear revision mode on reject
    };

    return (
        <div className="h-screen bg-background flex flex-col overflow-hidden">
            <ResizablePanelGroup direction="horizontal" className="flex-1">

                {/* --- LEFT PANEL (CHAT) --- */}
                <ResizablePanel defaultSize={60} minSize={30} maxSize={75} className="flex flex-col relative z-10 border-r border-border/40">
                    <div className="h-full flex flex-col bg-muted/20 dark:bg-zinc-900/50 relative">

                        {/* TOP LEFT ACTIONS: HISTORY & BACK */}
                        <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
                            {/* HISTORY MENU */}
                            <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                                <SheetTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                                        <Menu className="w-5 h-5" />
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="left" className="w-[320px] sm:w-[400px] p-6">
                                    <SheetHeader className="mb-6">
                                        <SheetTitle>History</SheetTitle>
                                        <SheetDescription className="sr-only">
                                            View and manage your conversation history
                                        </SheetDescription>
                                    </SheetHeader>

                                    {/* New Chat Button */}
                                    <Button variant="outline" size="sm" onClick={handleNewChat} className="w-full h-9 gap-2 mb-4">
                                        <Plus className="w-4 h-4" /> New Conversation
                                    </Button>

                                    {/* Search Bar */}
                                    <div className="relative mb-4">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search conversations..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-180px)] relative">
                                        {history
                                            .filter(item =>
                                                item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                searchQuery === ""
                                            )
                                            .map(item => (
                                                <div
                                                    key={item.id}
                                                    className={`group flex items-center gap-2 rounded-lg transition-colors cursor-pointer ${conversationId === item.id
                                                        ? 'bg-secondary'
                                                        : 'hover:bg-muted'
                                                        }`}
                                                >
                                                    <button
                                                        className="flex-1 text-left py-3 px-3 overflow-hidden"
                                                        onClick={() => handleSelectConversation(item.id)}
                                                    >
                                                        <div className="flex flex-col gap-1">
                                                            <span className="truncate font-medium text-sm text-foreground flex items-center gap-1.5">
                                                                {(item as any).is_favorite && <Star className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />}
                                                                {item.title || "Untitled Conversation"}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {new Date(item.updated_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    </button>

                                                    {/* Dropdown Menu */}
                                                    <div className="relative shrink-0 mr-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                setMenuPosition({ top: rect.bottom + 4, left: rect.left - 120 });
                                                                setOpenMenuId(openMenuId === item.id ? null : item.id);
                                                            }}
                                                        >
                                                            <MoreHorizontal className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        {history.length === 0 && (
                                            <p className="text-sm text-muted-foreground text-center py-10">No history yet</p>
                                        )}
                                        {history.length > 0 && history.filter(item =>
                                            item.title?.toLowerCase().includes(searchQuery.toLowerCase())
                                        ).length === 0 && (
                                                <p className="text-sm text-muted-foreground text-center py-10">No matching conversations</p>
                                            )}
                                    </div>

                                    {/* Dropdown Menu Portal - rendered outside scroll area */}
                                    {openMenuId && (
                                        <>
                                            <div className="fixed inset-0 z-[100]" onClick={() => setOpenMenuId(null)} />
                                            <div
                                                className="fixed z-[101] w-40 bg-popover border border-border rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
                                                style={{ top: menuPosition.top, left: menuPosition.left }}
                                            >
                                                <button
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 text-foreground"
                                                    onClick={(e) => handleToggleFavorite(openMenuId, e)}
                                                >
                                                    <Star className={`w-4 h-4 ${history.find(h => h.id === openMenuId && (h as any).is_favorite) ? 'fill-amber-500 text-amber-500' : 'text-amber-500'}`} />
                                                    {history.find(h => h.id === openMenuId && (h as any).is_favorite) ? 'Unfavorite' : 'Favorite'}
                                                </button>
                                                <div className="h-px bg-border my-1" />
                                                <button
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-2"
                                                    onClick={(e) => handleDeleteConversation(openMenuId, e)}
                                                >
                                                    <Trash2 className="w-4 h-4" /> Delete
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </SheetContent>
                            </Sheet>

                            {/* BACK BUTTON */}
                            <Button
                                variant="ghost" size="sm"
                                className="text-muted-foreground hover:text-foreground transition-colors gap-2"
                                onClick={() => router.push('/dashboard')}
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span className="hidden sm:inline">Back</span>
                            </Button>
                        </div>

                        {/* CHAT SCROLL AREA */}
                        <ScrollArea className="flex-1 px-4 lg:px-8">
                            <div className="max-w-3xl mx-auto flex flex-col min-h-[calc(100vh-140px)] py-6 pt-14">

                                {messages.length === 0 && revisionProposals.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center pb-20 opacity-90">
                                        <div className="mb-8 relative group cursor-default">
                                            <div className="absolute -inset-2 bg-gradient-to-tr from-primary/20 to-purple-500/20 rounded-3xl blur-lg opacity-40 group-hover:opacity-60 transition duration-500"></div>
                                            <div className="relative w-20 h-20 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center shadow-xl border border-primary/10">
                                                <Scale className="w-10 h-10 stroke-[2.5]" />
                                            </div>
                                        </div>
                                        <h2 className="text-xl font-heading font-medium text-foreground">Rule VII Architect</h2>
                                        <p className="text-sm text-muted-foreground mt-2 text-center max-w-sm">
                                            I am ready to analyze your floor plans against the National Building Code.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4 pb-4">
                                        {/* Messages with revision actions inline */}
                                        {messages.map((msg) => (
                                            <div key={msg.id}>
                                                <MessageBubble
                                                    id={msg.id}
                                                    role={msg.role}
                                                    content={msg.content}
                                                    timestamp={msg.timestamp}
                                                    attachment={msg.attachment}
                                                    sources={msg.sources}
                                                    revisionData={msg.revisionData}
                                                    onEdit={handleEditPrompt}
                                                    onAddToDraft={msg.role === 'assistant' && !msg.revisionData ? handleAddToDraft : undefined}
                                                    onReply={msg.role === 'assistant' && !msg.revisionData ? handleReplyToMessage : undefined}
                                                    onApproveRevision={handleApproveRevision}
                                                    onReviseAgain={handleReviseAgain}
                                                    onRejectRevision={handleRejectRevision}
                                                />
                                                {msg.proposal && (
                                                    <DraftBubble
                                                        proposal={msg.proposal}
                                                        onApprove={handleApproveDraft}
                                                        onReject={handleRejectDraft}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                        <div ref={scrollRef} />
                                    </div>
                                )}

                                {/* Thought Stream */}
                                <AnimatePresence>
                                    {showThoughtStream && (
                                        <ThoughtStream
                                            steps={thoughtSteps}
                                            isComplete={isThoughtComplete}
                                            mode={chatMode}
                                        />
                                    )}
                                </AnimatePresence>
                            </div>
                        </ScrollArea>

                        {/* FLOATING INPUT AREA */}
                        <div className="relative z-30 pb-4">
                            <div className="absolute bottom-full left-0 right-0 h-12 bg-gradient-to-t from-background/50 to-transparent pointer-events-none" />

                            {/* Project Context Banner */}
                            {isLoadingProject && (
                                <div className="px-4 lg:px-8 mb-3">
                                    <div className="max-w-3xl mx-auto">
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-full text-sm">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                                            <span className="text-muted-foreground">Loading project...</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {projectContext && !isLoadingProject && (
                                <div className="px-4 lg:px-8 mb-3">
                                    <div className="max-w-3xl mx-auto">
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-sm">
                                            <FolderOpen className="w-3.5 h-3.5 text-primary" />
                                            <span className="font-medium">{projectContext.name}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <InputArea
                                onSendMessage={handleSendMessage}
                                disabled={isLoading}
                                initialValue={inputOverride}
                                replyingTo={replyingTo}
                                onCancelReply={handleCancelReply}
                            />
                        </div>

                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle className="bg-border/50 transition-colors hover:bg-primary/50 w-1" />

                {/* --- RIGHT PANEL (DOCUMENT) --- */}
                <ResizablePanel defaultSize={40} minSize={25} maxSize={70} collapsible={true} collapsedSize={0}>
                    {/* Step 4: Remove revisingSection from DocumentPanel */}
                    <DocumentPanel
                        sections={sections}
                        onDelete={handleDeleteSection}
                        onRevise={handleReviseSection}
                        onEdit={handleEditSection}
                    />
                </ResizablePanel>

            </ResizablePanelGroup>

            {/* EDIT MODAL OVERLAY */}
            {editingSection && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-lg bg-background border border-border rounded-xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center pb-2 border-b">
                            <h3 className="font-semibold text-lg">Edit Section</h3>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setEditingSection(null)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Title</label>
                                <Input
                                    value={editForm.title}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Content</label>
                                <Textarea
                                    className="min-h-[300px] font-mono text-sm leading-relaxed"
                                    value={editForm.content}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="ghost" onClick={() => setEditingSection(null)}>Cancel</Button>
                            <Button onClick={saveSectionEdit}>Save Changes</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Revision Modal */}
            <RevisionModal
                isOpen={revisionModalOpen}
                onClose={() => {
                    setRevisionModalOpen(false);
                    setRevisingSection(null);
                }}
                section={revisingSection}
                onSubmit={handleSubmitRevision}
                isLoading={isRevisionLoading}
            />
        </div>
    );
}

// useSearchParams() needs a Suspense boundary for the production build
export default function WorkspacePageWrapper() {
    return (
        <Suspense fallback={null}>
            <WorkspacePage />
        </Suspense>
    );
}
