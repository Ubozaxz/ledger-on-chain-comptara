import { forwardRef, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';

export const ThemeToggle = forwardRef<HTMLButtonElement>(function ThemeToggle(_props, ref) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = !mounted || resolvedTheme === 'dark';

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="sm"
      aria-label={isDark ? 'Mode clair' : 'Mode sombre'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="touch-manipulation h-8 w-8 p-0"
    >
      {isDark ? <Sun className="h-4 w-4 text-warning" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
});
