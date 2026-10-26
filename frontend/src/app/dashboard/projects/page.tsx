"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
// Use shared supabase client to avoid multiple instances
import { supabase } from '@/lib/supabase';
import { API_URL } from "@/lib/api-client";
import {
    FolderPlus,
    MoreHorizontal,
    MessageSquare,
    FileText,
    Calendar,
    Search,
    ArrowLeft,
    MapPin,
    X,
    Trash2,
    Edit,
    Loader2,
    LayoutTemplate,
    Upload,
    ImageIcon,
    File as FileIcon,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Dynamic imports for ReactBits components
const Squares = dynamic(() => import('@/components/ui/Squares'), {
    ssr: false
});
const BlurFade = dynamic(() => import('@/components/ui/BlurFade'), {
    ssr: false
});
const Shimmer = dynamic(() => import('@/components/ui/Shimmer'), {
    ssr: false
});

// --- 1. DEFINE TYPES ---
interface Project {
    id: string;
    name: string;
    description?: string;
    location?: string;
    status: string;
    created_at: string;
    priority?: 'low' | 'medium' | 'critical';
    cycle?: 'active' | 'approved';
    thumbnailClass?: string;
}

interface UploadedFile {
    file: File;
    preview?: string;  // For image preview
    error?: string;
}

// File validation constants
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.pdf', '.jpeg', '.jpg', '.png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function ProjectsPage() {
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // MODAL STATES
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null); // Track if we are editing

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        location: "",
        description: ""
    });

    // File Upload State
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [fileError, setFileError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // --- 2. FETCH PROJECTS ---
    const fetchProjects = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(`${API_URL}/api/v1/projects/`, {
                headers: { "Authorization": `Bearer ${session.access_token}` }
            });

            if (res.ok) {
                const data = await res.json();
                const enrichedData = data.map((p: Project, index: number) => ({
                    ...p,
                    thumbnailClass: getGradient(index)
                }));
                setProjects(enrichedData);
            }
        } catch (error) {
            console.error("Error fetching projects:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, [supabase]);

    // --- 3. HANDLE MODAL OPEN/CLOSE ---
    const openCreateModal = () => {
        setEditingProject(null); // Clear editing state
        setFormData({ name: "", location: "", description: "" }); // Reset form
        setUploadedFiles([]); // Reset files
        setFileError(null);
        setIsModalOpen(true);
    };

    const openEditModal = (project: Project) => {
        setEditingProject(project); // Set the project we are editing
        setFormData({
            name: project.name,
            location: project.location || "",
            description: project.description || ""
        });
        setUploadedFiles([]); // Reset for edit mode (files already uploaded)
        setFileError(null);
        setIsModalOpen(true);
    };

    // --- FILE VALIDATION ---
    const validateFile = (file: File): string | null => {
        // Check MIME type
        if (!ALLOWED_TYPES.includes(file.type)) {
            return `Invalid file type: ${file.type}. Only PDF, JPEG, PNG allowed.`;
        }
        // Check extension
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return `Invalid extension: ${ext}. Only .pdf, .jpeg, .jpg, .png allowed.`;
        }
        // Check size
        if (file.size > MAX_FILE_SIZE) {
            return `File too large: ${(file.size / (1024 * 1024)).toFixed(1)}MB. Max 10MB.`;
        }
        return null;
    };

    // --- HANDLE FILE SELECT ---
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFileError(null);
        const files = e.target.files;
        if (!files) return;

        const newFiles: UploadedFile[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const error = validateFile(file);

            if (error) {
                setFileError(error);
                continue;
            }

            // Create preview for images
            let preview: string | undefined;
            if (file.type.startsWith('image/')) {
                preview = URL.createObjectURL(file);
            }

            newFiles.push({ file, preview });
        }

        setUploadedFiles(prev => [...prev, ...newFiles]);
        e.target.value = ''; // Reset input
    };

    const removeFile = (index: number) => {
        setUploadedFiles(prev => {
            const file = prev[index];
            if (file.preview) URL.revokeObjectURL(file.preview);
            return prev.filter((_, i) => i !== index);
        });
    };

    // --- 4. HANDLE SUBMIT (CREATE OR UPDATE) ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                alert("Please log in.");
                return;
            }

            // DETERMINE IF CREATING OR UPDATING
            const url = editingProject
                ? `${API_URL}/api/v1/projects/${editingProject.id}` // PUT URL
                : `${API_URL}/api/v1/projects/`; // POST URL

            const method = editingProject ? "PUT" : "POST";

            const res = await fetch(url, {
                method: method,
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            });

            if (!res.ok) throw new Error("Operation failed");

            const projectData = await res.json();
            const projectId = editingProject?.id || projectData.id;

            // Upload files if any (only on create, not edit for now)
            if (uploadedFiles.length > 0 && projectId) {
                setIsUploading(true);
                for (const { file } of uploadedFiles) {
                    const formData = new FormData();
                    formData.append('file', file);

                    try {
                        await fetch(`${API_URL}/api/v1/projects/${projectId}/files`, {
                            method: 'POST',
                            headers: {
                                "Authorization": `Bearer ${session.access_token}`,
                            },
                            body: formData,
                        });
                    } catch (uploadError) {
                        console.error("File upload error:", uploadError);
                    }
                }
                setIsUploading(false);
            }

            // Success!
            await fetchProjects();
            setIsModalOpen(false);

        } catch (error) {
            alert("Failed to save project");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- 5. DELETE PROJECT ---
    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this project?")) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(`${API_URL}/api/v1/projects/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${session.access_token}` }
            });

            if (res.ok) {
                setProjects(prev => prev.filter(p => p.id !== id));
            }
        } catch (error) {
            console.error("Delete error:", error);
        }
    };

    // --- 6. APPROVE PROJECT ---
    const handleApprove = async (id: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(`${API_URL}/api/v1/projects/${id}`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ cycle: 'approved' })
            });

            if (res.ok) {
                setProjects(prev => prev.map(p =>
                    p.id === id ? { ...p, cycle: 'approved' as const } : p
                ));
            }
        } catch (error) {
            console.error("Approve error:", error);
        }
    };

    // Helper for UI gradients
    const getGradient = (index: number) => {
        const gradients = [
            "from-blue-500/20 to-cyan-500/20",
            "from-purple-500/20 to-pink-500/20",
            "from-emerald-500/20 to-teal-500/20",
            "from-amber-500/20 to-orange-500/20",
            "from-indigo-500/20 to-violet-500/20"
        ];
        return gradients[index % gradients.length];
    }

    return (
        <div className="flex-1 flex flex-col h-screen bg-neutral-50/40 dark:bg-neutral-950 overflow-hidden relative">
            {/* Squares Background */}
            <Squares
                direction="diagonal"
                speed={0.5}
                squareSize={60}
                borderColor="rgba(100, 100, 100, 0.15)"
                hoverFillColor="rgba(100, 100, 100, 0.05)"
                className="absolute inset-0 pointer-events-none blur-sm"
            />

            {/* 1. HEADER */}
            <div className="px-8 py-6 border-b border-border/40 flex items-center justify-between bg-background/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
                            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-heading font-bold text-foreground">My Projects</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">Manage your analysis contexts and uploaded plans.</p>
                    </div>
                </div>

                {/* Create Button (Visible even if empty, for consistency) */}
                {projects.length > 0 && (
                    <Button
                        className="shadow-lg shadow-primary/20 gap-2"
                        onClick={openCreateModal}
                    >
                        <FolderPlus className="w-4 h-4" />
                        Create Project
                    </Button>
                )}
            </div>

            {/* 2. CONTENT AREA */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-6xl mx-auto space-y-6">

                    {/* CONDITIONAL RENDER: Loading vs Empty vs List */}
                    {isLoading ? (
                        <Shimmer rows={6} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" />
                    ) : projects.length === 0 ? (

                        /* --- HERO EMPTY STATE (Your New Design) --- */
                        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center border-2 border-dashed border-border/50 rounded-3xl bg-muted/5 p-12">
                            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 ring-8 ring-primary/5">
                                <LayoutTemplate className="w-10 h-10 text-primary" />
                            </div>
                            <h2 className="text-3xl font-heading font-semibold text-foreground mb-3">
                                No projects found
                            </h2>
                            <p className="text-muted-foreground max-w-md mb-8 text-lg">
                                It looks like you haven't created any analysis projects yet. Start by setting up a new workspace.
                            </p>
                            <Button
                                size="lg"
                                className="h-12 px-8 text-base shadow-xl shadow-primary/20"
                                onClick={openCreateModal}
                            >
                                <FolderPlus className="w-5 h-5 mr-2" />
                                Create First Project
                            </Button>
                        </div>

                    ) : (

                        /* --- GRID STATE (Normal Design) --- */
                        <>
                            {/* Search Bar */}
                            <div className="relative max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search projects..."
                                    className="pl-9 bg-background/50 border-border/50 focus:bg-background transition-all rounded-xl"
                                />
                            </div>

                            {/* Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                                {projects.map((project, index) => (
                                    <BlurFade key={project.id} delay={index * 0.05}>
                                        <ProjectCard
                                            project={project}
                                            onDelete={() => handleDelete(project.id)}
                                            onEdit={() => openEditModal(project)}
                                            onApprove={() => handleApprove(project.id)}
                                        />
                                    </BlurFade>
                                ))}

                                {/* Ghost Card */}
                                <button
                                    onClick={openCreateModal}
                                    className="group flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border hover:border-primary/50 bg-transparent hover:bg-muted/30 transition-all h-[280px]"
                                >
                                    <div className="w-16 h-16 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                                        <FolderPlus className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <div className="text-sm font-medium text-muted-foreground group-hover:text-primary">Create New Project</div>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* 3. SHARED MODAL (For Create AND Edit) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-background border border-border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-gradient-to-r from-muted/50 to-muted/30">
                            {/* Dynamic Title */}
                            <h3 className="font-bold text-lg">
                                {editingProject ? "Edit Project" : "New Project"}
                            </h3>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsModalOpen(false)}
                                className="h-8 w-8 rounded-full hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-500 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">Project Name</label>
                                <Input
                                    placeholder="e.g. Taguig Residential Tower"
                                    required
                                    autoFocus
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Location</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="City, Address"
                                        className="pl-9"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Description</label>
                                <Textarea
                                    placeholder="Brief details about zoning, floor area, etc..."
                                    className="min-h-[100px] resize-none"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            {/* File Upload Section */}
                            {!editingProject && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">
                                        Upload Files <span className="text-xs text-muted-foreground/60">(PDF, JPEG, PNG only)</span>
                                    </label>

                                    {/* Dropzone */}
                                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/40 transition-colors">
                                        <div className="flex flex-col items-center justify-center py-4">
                                            <Upload className="w-6 h-6 mb-2 text-muted-foreground" />
                                            <p className="text-xs text-muted-foreground">
                                                Click to upload or drag files here
                                            </p>
                                        </div>
                                        <input
                                            type="file"
                                            className="hidden"
                                            multiple
                                            accept=".pdf,.jpeg,.jpg,.png"
                                            onChange={handleFileSelect}
                                        />
                                    </label>

                                    {/* Error Message */}
                                    {fileError && (
                                        <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                                            <AlertCircle className="w-4 h-4 shrink-0" />
                                            {fileError}
                                        </div>
                                    )}

                                    {/* File List */}
                                    {uploadedFiles.length > 0 && (
                                        <div className="space-y-2 max-h-32 overflow-y-auto">
                                            {uploadedFiles.map((uf, index) => (
                                                <div key={index} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                                                    {/* Preview or Icon */}
                                                    {uf.preview ? (
                                                        <img src={uf.preview} alt="" className="w-10 h-10 rounded object-cover" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                                            <FileIcon className="w-5 h-5 text-red-500" />
                                                        </div>
                                                    )}

                                                    {/* File Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-medium truncate">{uf.file.name}</p>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            {(uf.file.size / 1024).toFixed(0)} KB
                                                        </p>
                                                    </div>

                                                    {/* Remove Button */}
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 shrink-0"
                                                        onClick={() => removeFile(index)}
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="pt-2 flex gap-3 justify-end">
                                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={isSubmitting || isUploading}>
                                    {isSubmitting || isUploading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            {isUploading ? "Uploading..." : "Saving..."}
                                        </>
                                    ) : (
                                        editingProject ? "Save Changes" : "Create Project"
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}

// --- SUB-COMPONENT ---
function ProjectCard({ project, onDelete, onEdit, onApprove }: { project: Project, onDelete: () => void, onEdit: () => void, onApprove: () => void }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const dateStr = new Date(project.created_at).toLocaleDateString('en-GB');
    const isHighAlert = project.priority === 'critical' || project.priority === 'medium';
    const isApproved = project.cycle === 'approved';

    return (
        <div className="group relative flex flex-col bg-card/50 hover:bg-card border border-border/50 hover:border-primary/20 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-black/20 h-[300px]">

            <div className={cn("h-24 w-full bg-gradient-to-br relative transition-all", project.thumbnailClass)}>
                {/* Priority Alert Icon */}
                {isHighAlert && (
                    <div className="absolute top-3 left-3">
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm",
                            project.priority === 'critical'
                                ? "bg-rose-500/90 text-white"
                                : "bg-amber-500/90 text-white"
                        )}>
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                    </div>
                )}

                {/* Dropdown Menu */}
                <div className="absolute top-3 right-3">
                    <div className="relative">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="h-8 w-8 bg-black/10 hover:bg-black/20 text-white rounded-full backdrop-blur-sm"
                        >
                            <MoreHorizontal className="w-4 h-4" />
                        </Button>

                        {isMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
                                <div className="absolute right-0 mt-2 w-40 bg-popover border border-border rounded-lg shadow-lg z-20 py-1 animate-in fade-in zoom-in-95 duration-100">
                                    <button
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2 text-foreground"
                                        onClick={() => { onEdit(); setIsMenuOpen(false); }}
                                    >
                                        <Edit className="w-3 h-3" /> Edit
                                    </button>
                                    {!isApproved && (
                                        <button
                                            className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 text-emerald-600 dark:hover:bg-emerald-900/20 flex items-center gap-2"
                                            onClick={() => { onApprove(); setIsMenuOpen(false); }}
                                        >
                                            <ShieldCheck className="w-3 h-3" /> Mark as Approved
                                        </button>
                                    )}
                                    <button
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-600 dark:hover:bg-red-900/20 flex items-center gap-2"
                                        onClick={() => { onDelete(); setIsMenuOpen(false); }}
                                    >
                                        <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <div className="absolute -bottom-6 left-6 w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center shadow-sm">
                    <FileText className="w-6 h-6 text-primary/80" />
                </div>
            </div>

            <div className="flex-1 p-6 pt-8 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-heading font-semibold text-lg line-clamp-1">{project.name}</h3>
                    {/* Cycle Status Badge */}
                    <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-semibold border",
                        isApproved
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900"
                            : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900"
                    )}>
                        {isApproved ? (
                            <span className="flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                            </span>
                        ) : (
                            <span className="flex items-center gap-1">
                                Active
                            </span>
                        )}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-4 flex-1">
                    {project.description || "No description provided."}
                </p>

                <div className="flex items-center gap-4 text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-5">
                    <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" />
                        {project.location || "Unknown"}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        {dateStr}
                    </div>
                </div>

                <Link href={`/dashboard/new?project=${project.id}`} className="w-full">
                    <Button variant="outline" className="w-full justify-between group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all text-xs">
                        Chat with Rule VII AI
                        <MessageSquare className="w-3 h-3 ml-2 opacity-50 group-hover:opacity-100" />
                    </Button>
                </Link>
            </div>
        </div>
    )
}