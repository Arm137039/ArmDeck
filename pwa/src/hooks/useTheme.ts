import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';

const useTheme = () => {
    const [theme, setTheme] = useState<Theme>(() => {
        const saved = localStorage.getItem('theme');
        return (saved as Theme) || 'dark';
    });

    useEffect(() => {
        const handleStorageChange = () => {
            const newTheme = localStorage.getItem('theme') as Theme || 'dark';
            setTheme(newTheme);
        };

        window.addEventListener('storage', handleStorageChange);
        const interval = setInterval(handleStorageChange, 100);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        document.body.className = `theme-${newTheme}`;
    };

    return { theme, toggleTheme };
};

export default useTheme;