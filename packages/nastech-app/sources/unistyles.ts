import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';
import {
    darkTheme, lightTheme,
    amoledBlackTheme, superAmoledBlackTheme, charcoalTheme,
    greyTheme, steelGreyTheme, lightGreyTheme,
    darkBlueTheme, midnightBlueTheme, lightBlueTheme,
    darkGreenTheme, darkPurpleTheme, darkRedTheme,
} from './theme';
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
    superAmoledBlack: superAmoledBlackTheme,
    charcoal: charcoalTheme,
    grey: greyTheme,
    steelGrey: steelGreyTheme,
    lightGrey: lightGreyTheme,
    darkBlue: darkBlueTheme,
    midnightBlue: midnightBlueTheme,
    lightBlue: lightBlueTheme,
    darkGreen: darkGreenTheme,
    darkPurple: darkPurpleTheme,
    darkRed: darkRedTheme,
};

export type AppThemeName = keyof typeof appThemes;

export const THEME_NAMES: { id: AppThemeName; label: string }[] = [
    // ── Dark ──────────────────────────────────────────────
    { id: 'superAmoledBlack', label: 'Super AMOLED Black' },
    { id: 'amoledBlack',      label: 'AMOLED Black' },
    { id: 'charcoal',         label: 'Charcoal' },
    { id: 'dark',             label: 'Dark' },
    // ── Grey ──────────────────────────────────────────────
    { id: 'grey',             label: 'Dark Grey' },
    { id: 'steelGrey',        label: 'Steel Grey' },
    { id: 'lightGrey',        label: 'Light Grey' },
    // ── Blue ──────────────────────────────────────────────
    { id: 'midnightBlue',     label: 'Midnight Blue' },
    { id: 'darkBlue',         label: 'Dark Blue' },
    { id: 'lightBlue',        label: 'Light Blue' },
    // ── Colour ────────────────────────────────────────────
    { id: 'darkGreen',        label: 'Dark Green' },
    { id: 'darkPurple',       label: 'Dark Purple' },
    { id: 'darkRed',          label: 'Dark Red' },
    // ── Light ─────────────────────────────────────────────
    { id: 'light',            label: 'Light' },
];

const breakpoints = {
    xs: 0,
    sm: 300,
    md: 500,
    lg: 800,
    xl: 1200,
};

const themePreference = loadThemePreference();

const getInitialTheme = (): AppThemeName => {
    if (themePreference === 'adaptive') {
        const systemTheme = Appearance.getColorScheme();
        return systemTheme === 'dark' ? 'dark' : 'light';
    }
    if (themePreference && themePreference in appThemes) {
        return themePreference as AppThemeName;
    }
    return 'superAmoledBlack';
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

const setRootBackgroundColor = () => {
    const themeName = getInitialTheme();
    const color = appThemes[themeName]?.colors?.groupped?.background
        ?? appThemes.superAmoledBlack.colors.groupped.background;
    UnistylesRuntime.setRootViewBackgroundColor(color as string);
    SystemUI.setBackgroundColorAsync(color as string);
};

setRootBackgroundColor();

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
