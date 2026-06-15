import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';
import { darkTheme, lightTheme, amoledBlackTheme, darkBlueTheme, lightBlueTheme, greyTheme } from './theme';
import { loadThemePreference } from './sync/persistence';
import { Appearance, Platform } from 'react-native';
import * as SystemUI from 'expo-system-ui';

//
// Theme registry
//

const appThemes = {
    light: lightTheme,
    dark: darkTheme,
    amoledBlack: amoledBlackTheme,
    darkBlue: darkBlueTheme,
    lightBlue: lightBlueTheme,
    grey: greyTheme,
};

export type AppThemeName = keyof typeof appThemes;

export const THEME_NAMES: { id: AppThemeName; label: string }[] = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'amoledBlack', label: 'AMOLED Black' },
    { id: 'darkBlue', label: 'Dark Blue' },
    { id: 'lightBlue', label: 'Light Blue' },
    { id: 'grey', label: 'Grey' },
];

const breakpoints = {
    xs: 0,
    sm: 300,
    md: 500,
    lg: 800,
    xl: 1200,
};

// Load theme preference from storage
const themePreference = loadThemePreference();

// Determine initial theme
const getInitialTheme = (): AppThemeName => {
    if (themePreference === 'adaptive') {
        const systemTheme = Appearance.getColorScheme();
        return systemTheme === 'dark' ? 'dark' : 'light';
    }
    return (themePreference as AppThemeName) || 'dark';
};

const settings = themePreference === 'adaptive'
    ? { adaptiveThemes: true, CSSVars: true }
    : { initialTheme: getInitialTheme(), CSSVars: true };

//
// Bootstrap
//

type AppThemes = typeof appThemes;
type AppBreakpoints = typeof breakpoints;

declare module 'react-native-unistyles' {
    export interface UnistylesThemes extends AppThemes { }
    export interface UnistylesBreakpoints extends AppBreakpoints { }
}

StyleSheet.configure({
    settings,
    breakpoints,
    themes: appThemes,
});

// Set initial root view background color based on theme
const setRootBackgroundColor = () => {
    const themeName = getInitialTheme();
    const color = appThemes[themeName]?.colors?.groupped?.background
        ?? appThemes.dark.colors.groupped.background;
    UnistylesRuntime.setRootViewBackgroundColor(color as string);
    SystemUI.setBackgroundColorAsync(color as string);
};

setRootBackgroundColor();

// Re-sync theme when tab becomes visible (web only)
if (Platform.OS === 'web' && themePreference === 'adaptive') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            const themeName = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
            UnistylesRuntime.setAdaptiveThemes(false);
            UnistylesRuntime.setTheme(themeName);
            UnistylesRuntime.setAdaptiveThemes(true);
            const color = appThemes[themeName].colors.groupped.background;
            UnistylesRuntime.setRootViewBackgroundColor(color as string);
        }
    });
}
