import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThemeStore } from "@/state/client/themeStore";

export function ThemeSwitcher() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  const themes = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "dim" as const, label: "Dim", icon: Monitor },
  ];

  const currentThemeIcon = themes.find((t) => t.value === theme)?.icon || Sun;
  const Icon = currentThemeIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Icon className="h-4 w-4" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themes.map((t) => {
          const ThemeIcon = t.icon;
          return (
            <DropdownMenuItem
              key={t.value}
              onClick={() => setTheme(t.value)}
              className="flex cursor-pointer items-center gap-2"
            >
              <ThemeIcon className="h-4 w-4" />
              <span>{t.label}</span>
              {theme === t.value && <span className="text-primary ml-auto">✓</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
