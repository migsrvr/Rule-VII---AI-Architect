// Mirrors backend/app/models/chat.py
import type { ChatMode, AttachmentMetaData } from "@/types";

export interface ChatRequest {
    message: string;
    conversation_id?: string;
    project_id?: string;
    mode?: ChatMode;
    reply_context?: string;
    attachments?: AttachmentMetaData[];
}

export interface ChatResponse {
    response: string;
    sources: any[];
    conversation_id: string;
    proposal?: Record<string, any> | null;
}

export interface ChatHistoryItem {
    id: string;
    title: string;
    updated_at: string;
    is_favorite?: boolean;
}

export interface ConversationMessage {
    id?: string;
    conversation_id: string;
    role: string;
    content: string;
    created_at: string;
    proposal?: Record<string, any> | null;
    attachment?: any;
}

export interface SavedProposal {
    id: string;
    user_id?: string;
    conversation_id: string;
    title: string;
    summary?: string | null;
    content?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface ProposalSaveRequest {
    conversation_id: string;
    title: string;
    summary?: string;
    content?: string;
}

export interface ProposalUpdateRequest {
    title: string;
    summary?: string;
    content?: string;
}
