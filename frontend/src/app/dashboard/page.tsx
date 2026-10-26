"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from '@/lib/supabase';
import { API_URL } from "@/lib/api-client";
import {
    ArrowUpRight,
    CheckCircle2,
    AlertTriangle,
    Clock,
    FileBox,
    Layers,
    Bell,
    Loader2,
    X,
    Calendar,
    MapPin,
    AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

// Dynamic imports for ReactBits components
const AnimatedCounter = dynamic(() => import('@/components/ui/AnimatedCounter'), {
    ssr: false
});
const BlurFade = dynamic(() => import('@/components/ui/BlurFade'), {
    ssr: false
});
const Shimmer = dynamic(() => import('@/components/ui/Shimmer'), {
    ssr: false
});
const Squares = dynamic(() => import('@/components/ui/Squares'), {
    ssr: false
});

// 1. Define the Interface
interface Project {
    id: string;
    name: string;
    location: string;
    status: string;
    created_at: string;
    priority?: 'low' | 'medium' | 'critical';
    cycle?: 'active' | 'approved';
}

export default function DashboardPage() {
    const currentDate = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();

    // --- REAL DATA STATE ---
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- MODAL STATE ---
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    // 3. Fetch Data Function
    async function fetchProjects() {
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                setIsLoading(false);
                return;
            }

            const res = await fetch(`${API_URL}/api/v1/projects/`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                    "Content-Type": "application/json"
                }
            });

            if (!res.ok) throw new Error("Failed to fetch projects");

            const data = await res.json();
            setProjects(data);
        } catch (error) {
            console.error("Dashboard Load Error:", error);
        } finally {
            setIsLoading(false);
        }
    }

    // Initial Load
    useEffect(() => {
        fetchProjects();
    }, []);

    // --- CALCULATE DASHBOARD METRICS ---
    const criticalProjects = projects.filter(p => p.priority === 'critical');
    const mediumProjects = projects.filter(p => p.priority === 'medium');
    const alertCount = criticalProjects.length + mediumProjects.length;

    // Determine Trend Text based on alerts
    let trendText = "No issues detected";
    let trendAlert = false;

    if (criticalProjects.length > 0) {
        trendText = `${criticalProjects.length} Critical Issue${criticalProjects.length > 1 ? 's' : ''}`;
        trendAlert = true;
    } else if (mediumProjects.length > 0) {
        trendText = `${mediumProjects.length} Need${mediumProjects.length > 1 ? '' : 's'} Attention`;
        trendAlert = true;
    }

    return (
        <div className="flex min-h-screen bg-neutral-50/40 dark:bg-neutral-950 text-foreground font-sans selection:bg-primary/10 relative overflow-hidden">
            {/* Animated Squares Background */}
            <Squares
                direction="diagonal"
                speed={0.5}
                squareSize={60}
                borderColor="rgba(100, 100, 100, 0.15)"
                hoverFillColor="rgba(100, 100, 100, 0.05)"
                className="absolute inset-0 pointer-events-none blur-sm"
            />

            <Sidebar />

            <div className="flex-1 flex flex-col relative">
                <Header />

                <main className="flex-1 p-6 lg:p-8 space-y-6 overflow-hidden flex flex-col">

                    {/* WELCOME SECTION */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-border/40">
                        <div className="space-y-2">
                            <div className="text-[10px] font-mono text-muted-foreground tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500/50 animate-pulse"></span>
                                SYSTEM ACTIVE &mdash; {currentDate}
                            </div>
                            <h2 className="text-3xl md:text-4xl font-heading font-bold tracking-tight text-foreground">
                                Project <span className="italic text-muted-foreground font-light">Overview</span>
                            </h2>
                            <p className="text-xs text-muted-foreground max-w-xl font-sans">
                                Monitor your active projects, track compliance alerts, and manage your analysis quota.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <Link href="/dashboard/new">
                                <Button
                                    className="h-10 px-6 text-xs font-sans uppercase tracking-widest shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90"
                                >
                                    New Analysis <ArrowUpRight className="ml-2 h-3 w-3" />
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* METRIC GRID */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <TechnicalCard
                            label="Active Projects"
                            value={isLoading ? "-" : projects.length.toString()}
                            subValue="TOTAL"
                            icon={Layers}
                            trend={`Updated just now`}
                        />
                        <TechnicalCard
                            label="Alerts"
                            value={isLoading ? "-" : alertCount.toString()}
                            subValue="FLAGGED"
                            icon={Bell}
                            trend={trendText}
                            alert={trendAlert}
                            highlight={alertCount > 0}
                        />
                        <TechnicalCard
                            label="Plan Usage"
                            value={isLoading ? "-" : projects.length.toString()}
                            subValue="USED"
                            icon={FileBox}
                            trend="Limit: 5 Projects"
                            alert={projects.length >= 5}
                        />
                    </div>

                    {/* RECENT PROJECTS TABLE */}
                    <section className="space-y-4 flex-1 flex flex-col min-h-0">
                        <div className="flex flex-col gap-1 px-1">
                            <h3 className="text-xl font-heading font-semibold tracking-tight text-foreground">
                                Recent Analysis
                            </h3>
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground font-sans">
                                    Your latest project submissions and compliance checks
                                </p>
                                <Link href="/dashboard/projects" className="text-xs font-mono text-primary hover:underline underline-offset-4 decoration-primary/30 transition-all">
                                    VIEW_ALL_PROJECTS &rarr;
                                </Link>
                            </div>
                        </div>

                        <div className="border border-border/40 rounded-sm bg-background/50 backdrop-blur-sm shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                            <div className="hidden md:grid grid-cols-12 px-6 py-3 border-b border-border/40 bg-neutral-100/30 dark:bg-neutral-900/30 text-[10px] uppercase tracking-widest font-medium text-muted-foreground/70">
                                <div className="col-span-5 pl-2">Project Identity</div>
                                <div className="col-span-3">Project Progress</div>
                                <div className="col-span-2 text-center">Priority</div>
                                <div className="col-span-2 text-right pr-2">Last Update</div>
                            </div>

                            <div className="divide-y divide-border/30 overflow-y-auto max-h-[300px]">
                                {isLoading ? (
                                    <Shimmer rows={5} />
                                ) : projects.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                        <FileBox className="w-8 h-8 mb-2 opacity-20" />
                                        <span className="text-xs font-mono">NO_PROJECTS_FOUND</span>
                                        <Link href="/dashboard/new" className="mt-2 text-xs text-primary hover:underline">
                                            Start your first analysis
                                        </Link>
                                    </div>
                                ) : (
                                    projects.slice(0, 5).map((project, index) => (
                                        <BlurFade key={project.id} delay={index * 0.05}>
                                            <ProjectRow
                                                project={project}
                                                onClick={() => setSelectedProject(project)}
                                            />
                                        </BlurFade>
                                    ))
                                )}
                            </div>
                        </div>
                    </section>
                </main>

                {/* MODAL OVERLAY */}
                <ProjectDetailsModal
                    project={selectedProject}
                    onClose={() => setSelectedProject(null)}
                />
            </div>
        </div>
    );
}

// --- SUB-COMPONENTS ---

// 1. Technical Card (Enhanced for impact)
function TechnicalCard({ label, value, subValue, icon: Icon, trend, highlight, alert }: any) {
    // Parse value to number for AnimatedCounter
    const numericValue = value === "-" ? 0 : parseInt(value) || 0;
    const isLoading = value === "-";

    return (
        <div className={cn(
            "group relative p-6 rounded-lg border transition-all duration-500 ease-out",
            "bg-gradient-to-br from-background via-background to-background/80",
            "hover:shadow-2xl hover:-translate-y-2",
            highlight ? "border-primary/30 shadow-lg shadow-primary/5" : "border-border/40 hover:border-border/60"
        )}>
            {/* Corner accent */}
            <div className={cn(
                "absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 rounded-tr-lg transition-colors",
                highlight ? "border-primary/40" : "border-transparent group-hover:border-border/60"
            )} />

            <div className="flex justify-between items-start mb-6">
                <div className={cn(
                    "p-2.5 rounded-lg transition-all duration-300",
                    highlight
                        ? "bg-primary/10 text-primary shadow-lg shadow-primary/20"
                        : "bg-neutral-100 dark:bg-neutral-800 text-muted-foreground group-hover:text-primary"
                )}>
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
                {alert && <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.6)]" />}
            </div>

            <div className="space-y-2">
                <div className="text-[10px] font-sans uppercase tracking-widest text-muted-foreground/80 font-semibold">
                    {label}
                </div>
                <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-mono font-light tracking-tighter text-foreground">
                        {isLoading ? "-" : <AnimatedCounter value={numericValue} />}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                        {subValue}
                    </span>
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border/30 flex items-center gap-2">
                <div className={cn(
                    "text-xs font-medium flex items-center gap-2",
                    alert ? "text-amber-600 dark:text-amber-500" : "text-emerald-600 dark:text-emerald-500"
                )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", alert ? "bg-amber-500" : "bg-emerald-500")} />
                    {trend}
                </div>
            </div>
        </div>
    )
}

// 2. Project Row (Added onClick prop)
function ProjectRow({ project, onClick }: { project: Project, onClick: () => void }) {
    const dateStr = new Date(project.created_at).toLocaleDateString('en-GB');

    return (
        <div
            onClick={onClick}
            className="group grid grid-cols-1 md:grid-cols-12 items-center gap-4 px-6 py-5 hover:bg-neutral-50/80 dark:hover:bg-neutral-900/50 transition-colors cursor-pointer border-l-2 border-transparent hover:border-primary/50"
        >
            <div className="col-span-1 md:col-span-5 flex flex-col pl-2">
                <span className="font-heading font-medium text-lg text-foreground/90 group-hover:text-primary transition-colors">
                    {project.name}
                </span>
                <span className="text-xs font-mono text-muted-foreground flex items-center gap-1 mt-1">
                    LOCATION: {project.location ? project.location.toUpperCase() : "UNKNOWN"}
                </span>
            </div>

            <div className="col-span-1 md:col-span-3">
                <CycleIndicator cycle={project.cycle || 'active'} />
            </div>

            <div className="col-span-1 md:col-span-2 md:text-center">
                <PriorityBadge priority={project.priority || 'low'} />
            </div>

            <div className="col-span-1 md:col-span-2 text-right pr-2">
                <span className="font-mono text-xs text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                    {dateStr.replace(/\//g, '.')}
                </span>
            </div>
        </div>
    )
}

function StatusIndicator({ status }: { status: string }) {
    const styles: Record<string, string> = {
        "Compliant": "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400",
        "Issues Found": "text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-400",
        "In Progress": "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400",
        "Active": "text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-400",
    };

    const styleClass = styles[status] || "text-muted-foreground bg-neutral-100 border-neutral-200";

    return (
        <span className={cn("inline-flex items-center px-3 py-1 rounded-sm text-[10px] uppercase tracking-widest font-medium border", styleClass)}>
            {status === "Compliant" && <CheckCircle2 className="w-3 h-3 mr-2" />}
            {(status === "Issues Found" || status === "Issues") && <AlertTriangle className="w-3 h-3 mr-2" />}
            {(status === "In Progress" || status === "Active") && <Clock className="w-3 h-3 mr-2" />}
            {status}
        </span>
    );
}

// Cycle Indicator (Active/Approved)
function CycleIndicator({ cycle }: { cycle: 'active' | 'approved' }) {
    const isApproved = cycle === 'approved';

    return (
        <span className={cn(
            "inline-flex items-center px-3 py-1 rounded-sm text-[10px] uppercase tracking-widest font-medium border",
            isApproved
                ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400"
                : "text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-400"
        )}>
            {isApproved ? (
                <><CheckCircle2 className="w-3 h-3 mr-2" /> Approved</>
            ) : (
                <><Clock className="w-3 h-3 mr-2" /> Active</>
            )}
        </span>
    );
}

// Priority Badge Component
function PriorityBadge({ priority }: { priority: 'low' | 'medium' | 'critical' }) {
    const styles: Record<string, string> = {
        'low': 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400',
        'medium': 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400',
        'critical': 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-400',
    };

    const icons = {
        'low': null,
        'medium': <AlertCircle className="w-3 h-3 mr-1.5" />,
        'critical': <AlertTriangle className="w-3 h-3 mr-1.5" />,
    };

    return (
        <span className={cn("inline-flex items-center px-2.5 py-1 rounded-sm text-[10px] uppercase tracking-widest font-medium border", styles[priority])}>
            {icons[priority]}
            {priority}
        </span>
    );
}

// 3. NEW: Project Details Modal
function ProjectDetailsModal({ project, onClose }: { project: Project | null, onClose: () => void }) {
    if (!project) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
            <div
                className="bg-background border border-border shadow-2xl rounded-sm w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-border/50 bg-neutral-50/50 dark:bg-neutral-900/50">
                    <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
                            Project ID: {project.id.slice(0, 8)}
                        </div>
                        <h3 className="text-xl font-heading font-medium text-foreground">
                            {project.name}
                        </h3>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-sm border border-border/50 space-y-2">
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <AlertCircle className="w-3 h-3" /> Priority
                            </span>
                            <div className="mt-1">
                                <PriorityBadge priority={project.priority || 'low'} />
                            </div>
                        </div>
                        <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-sm border border-border/50 space-y-2">
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Layers className="w-3 h-3" /> Status
                            </span>
                            <div className="mt-1">
                                <StatusIndicator status={project.status} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <div>
                                <span className="text-xs font-bold text-foreground block">Location</span>
                                <span className="text-sm text-muted-foreground">{project.location}</span>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <div>
                                <span className="text-xs font-bold text-foreground block">Created At</span>
                                <span className="text-sm text-muted-foreground">
                                    {new Date(project.created_at).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-border/50 bg-neutral-50/30 dark:bg-neutral-900/30 flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose} className="text-xs">
                        Close
                    </Button>
                    <Link href="/dashboard/projects">
                        <Button className="text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                            View Full Project
                        </Button>
                    </Link>

                </div>
            </div>
        </div>
    );
}