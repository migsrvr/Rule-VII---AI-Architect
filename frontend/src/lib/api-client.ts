import axios from "axios";
import { supabase } from "@/lib/supabase";
import type {
    ChatRequest,
    ChatResponse,
    ChatHistoryItem,
    ConversationMessage,
    SavedProposal,
    ProposalSaveRequest,
    ProposalUpdateRequest,
} from "@/lib/api-types";

// Backend base URL - set NEXT_PUBLIC_API_URL in Vercel for production
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");

const http = axios.create({ baseURL: `${API_URL}/api/v1` });

// Attach the Supabase JWT to every request (backend verifies it in core/security.py)
http.interceptors.request.use(async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
});

export const apiClient = {
    chat: {
        send: async (payload: ChatRequest): Promise<ChatResponse> =>
            (await http.post("/chat/", payload)).data,

        getHistory: async (): Promise<ChatHistoryItem[]> =>
            (await http.get("/chat/history")).data,

        getConversation: async (id: string): Promise<ConversationMessage[]> =>
            (await http.get(`/chat/${id}`)).data,

        deleteConversation: async (id: string): Promise<{ success: boolean }> =>
            (await http.delete(`/chat/conversation/${id}`)).data,

        toggleFavorite: async (id: string): Promise<{ is_favorite: boolean }> =>
            (await http.post(`/chat/favorite/${id}`)).data,

        saveProposal: async (payload: ProposalSaveRequest): Promise<SavedProposal> =>
            (await http.post("/chat/proposal", payload)).data,

        getSavedProposals: async (conversationId: string): Promise<SavedProposal[]> =>
            (await http.get(`/chat/proposals/${conversationId}`)).data,

        updateProposal: async (id: string, payload: ProposalUpdateRequest): Promise<SavedProposal> =>
            (await http.put(`/chat/proposal/${id}`, payload)).data,

        deleteProposal: async (id: string): Promise<{ success: boolean }> =>
            (await http.delete(`/chat/proposal/${id}`)).data,
    },

    analyze: {
        upload: async (file: File, message?: string): Promise<ChatResponse> => {
            const form = new FormData();
            form.append("file", file);
            if (message) form.append("message", message);
            return (await http.post("/analyze/", form)).data;
        },
    },
};
