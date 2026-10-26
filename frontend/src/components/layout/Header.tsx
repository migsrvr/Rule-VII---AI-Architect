"use client"

import { useState, useEffect, useRef } from "react";
import { Bell, Scale, User, Settings, LogOut, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from '@/lib/supabase';
import { API_URL } from "@/lib/api-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";

interface UserProfile {
    username: string;
    role: string;
    avatar_url?: string;
}

export default function Header() {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                // 1. GET THE REAL TOKEN FROM SUPABASE
                const { data: { session } } = await supabase.auth.getSession();

                if (!session?.access_token) {
                    console.error("No active session found. User might be logged out.");
                    setLoading(false);
                    return;
                }

                const token = session.access_token;

                // 2. USE THE TOKEN TO CALL BACKEND
                const response = await fetch(`${API_URL}/api/v1/users/me`, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    setUser(data);
                } else {
                    console.error("Backend rejected token:", response.status);
                }

            } catch (error) {
                console.error("Failed to fetch user:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen]);

    // Helper to get initials
    const getInitials = (name: string) => {
        return name ? name.substring(0, 2).toUpperCase() : "U";
    };

    const handleSignOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) console.error("Sign out error:", error);
        router.refresh();
        router.replace("/login");
    };

    return (
        <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 flex items-center justify-between sticky top-0 z-50">
            {/* Left: Branding */}
            <div className="flex items-center gap-3">
                <div className="bg-primary text-primary-foreground p-1.5 rounded-md md:hidden">
                    <Scale size={18} strokeWidth={3} />
                </div>
                <span className="font-semibold text-lg md:hidden">Rule VII</span>
                <h1 className="hidden md:flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    Project
                    <ChevronRight size={14} className="text-muted-foreground/50" />
                    <span className="text-foreground font-semibold">Dashboard</span>
                </h1>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-4">
                {/* Notification Bell */}
                <div className="relative">
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <Bell size={20} />
                    </Button>
                    {/* Notification Badge */}
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-background"></span>
                </div>

                <div className="h-6 w-px bg-border mx-1"></div>

                {/* User Profile with Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center gap-3 hover:bg-muted/50 rounded-lg px-2 py-1.5 transition-colors"
                    >
                        <div className="hidden md:block text-right">
                            {loading ? (
                                <div className="space-y-1">
                                    <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                                    <div className="h-2 w-12 bg-muted animate-pulse rounded ml-auto" />
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm font-medium leading-none">
                                        {user?.username || "Guest"}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {user?.role || "Free License"}
                                    </p>
                                </>
                            )}
                        </div>
                        <Avatar className="h-9 w-9 border-2 border-border ring-2 ring-transparent hover:ring-primary/20 transition-all">
                            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                {user ? getInitials(user.username) : "..."}
                            </AvatarFallback>
                        </Avatar>
                    </button>

                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                            <div className="absolute right-0 mt-2 w-56 bg-popover border border-border rounded-lg shadow-lg z-20 py-1 animate-in fade-in zoom-in-95 duration-100">
                                <div className="px-3 py-2 border-b border-border">
                                    <p className="text-sm font-medium">{user?.username || "Guest"}</p>
                                    <p className="text-xs text-muted-foreground">{user?.role || "Free License"}</p>
                                </div>
                                <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 text-foreground">
                                    <User size={16} />
                                    Profile
                                </button>
                                <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 text-foreground">
                                    <Settings size={16} />
                                    Settings
                                </button>
                                <div className="border-t border-border my-1"></div>
                                <button
                                    onClick={handleSignOut}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2 text-red-600 dark:text-red-500"
                                >
                                    <LogOut size={16} />
                                    Sign Out
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    )
}
