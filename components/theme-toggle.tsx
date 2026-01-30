"use client"

import * as React from "react"
import { Moon, Sun, CloudLightning } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
    const { setTheme, theme, resolvedTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return <div className="w-[104px] h-10" /> // Placeholder to prevent layout shift
    }

    const currentTheme = theme === 'system' ? resolvedTheme : theme

    return (
        <div className="flex items-center gap-1 border border-border/40 p-1 rounded-full bg-background/50 backdrop-blur-sm shadow-sm">
            <Button
                variant={currentTheme === "light" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setTheme("light")}
                title="Light Mode"
            >
                <Sun className="h-4 w-4" />
                <span className="sr-only">Light</span>
            </Button>
            <Button
                variant={currentTheme === "dim" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setTheme("dim")}
                title="Dim Mode"
            >
                <CloudLightning className="h-4 w-4" />
                <span className="sr-only">Dim</span>
            </Button>
            <Button
                variant={currentTheme === "dark" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setTheme("dark")}
                title="Dark Mode"
            >
                <Moon className="h-4 w-4" />
                <span className="sr-only">Dark</span>
            </Button>
        </div>
    )
}
