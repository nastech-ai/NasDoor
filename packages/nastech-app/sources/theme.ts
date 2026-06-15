import { Platform } from 'react-native';

const sharedSpacing = {
    margins: {
        xs: 4,
        sm: 8,
        md: 12,
        lg: 16,
        xl: 20,
        xxl: 24,
    },
    borderRadius: {
        sm: 4,
        md: 8,
        lg: 10,
        xl: 12,
        xxl: 16,
    },
    iconSize: {
        small: 12,
        medium: 16,
        large: 20,
        xlarge: 24,
    },
} as const;

// ─── Light ────────────────────────────────────────────────────────────────────
export const lightTheme = {
    dark: false,
    colors: {
        text: '#000000',
        textDestructive: Platform.select({ ios: '#FF3B30', default: '#F44336' }),
        textSecondary: Platform.select({ ios: '#8E8E93', default: '#49454F' }),
        textLink: '#2BACCC',
        deleteAction: '#FF6B6B',
        warningCritical: '#FF3B30',
        warning: '#8E8E93',
        success: '#34C759',
        surface: '#ffffff',
        surfaceRipple: 'rgba(0, 0, 0, 0.08)',
        surfacePressed: '#f0f0f2',
        surfaceSelected: Platform.select({ ios: '#C6C6C8', default: '#eaeaea' }),
        surfacePressedOverlay: Platform.select({ ios: '#D1D1D6', default: 'transparent' }),
        surfaceHigh: '#F8F8F8',
        surfaceHighest: '#f0f0f0',
        divider: '#eaeaea',
        shadow: {
            color: Platform.select({ default: '#000000', web: 'rgba(0, 0, 0, 0.1)' }),
            opacity: 0.1,
        },
        groupped: {
            background: Platform.select({ ios: '#F2F2F7', default: '#F5F5F5' }),
            chevron: Platform.select({ ios: '#C7C7CC', default: '#49454F' }),
            sectionTitle: Platform.select({ ios: '#8E8E93', default: '#49454F' }),
        },
        header: { background: '#ffffff', tint: '#18171C' },
        switch: {
            track: {
                active: Platform.select({ ios: '#34C759', default: '#1976D2' }),
                inactive: '#dddddd',
            },
            thumb: { active: '#FFFFFF', inactive: '#767577' },
        },
        fab: { background: '#000000', backgroundPressed: '#1a1a1a', icon: '#FFFFFF' },
        radio: { active: '#007AFF', inactive: '#C0C0C0', dot: '#007AFF' },
        modal: { border: 'rgba(0, 0, 0, 0.1)' },
        button: {
            primary: { background: '#000000', tint: '#FFFFFF', disabled: '#C0C0C0' },
            secondary: { tint: '#666666' },
        },
        input: { background: '#F5F5F5', text: '#000000', placeholder: '#999999' },
        box: {
            warning: { background: '#FFF8F0', border: '#FF9500', text: '#FF9500' },
            error: { background: '#FFF0F0', border: '#FF3B30', text: '#FF3B30' },
        },
        status: {
            connected: '#34C759',
            connecting: '#007AFF',
            disconnected: '#999999',
            error: '#FF3B30',
            default: '#8E8E93',
        },
        permission: {
            default: '#8E8E93',
            acceptEdits: '#007AFF',
            bypass: '#FF9500',
            plan: '#34C759',
            readOnly: '#8B8B8D',
            safeYolo: '#FF6B35',
            yolo: '#DC143C',
        },
        permissionButton: {
            allow: { background: '#34C759', text: '#FFFFFF' },
            deny: { background: '#FF3B30', text: '#FFFFFF' },
            allowAll: { background: '#007AFF', text: '#FFFFFF' },
            inactive: { background: '#E5E5EA', border: '#D1D1D6', text: '#8E8E93' },
            selected: { background: '#F2F2F7', border: '#D1D1D6', text: '#3C3C43' },
        },
        diff: {
            outline: '#E0E0E0',
            success: '#28A745',
            error: '#DC3545',
            addedBg: '#E6FFED', addedBorder: '#34D058', addedText: '#24292E',
            removedBg: '#FFEEF0', removedBorder: '#D73A49', removedText: '#24292E',
            contextBg: '#F6F8FA', contextText: '#586069',
            lineNumberBg: '#F6F8FA', lineNumberText: '#959DA5',
            hunkHeaderBg: '#F1F8FF', hunkHeaderText: '#005CC5',
            leadingSpaceDot: '#E8E8E8',
            inlineAddedBg: '#ACFFA6', inlineAddedText: '#0A3F0A',
            inlineRemovedBg: '#FFCECB', inlineRemovedText: '#5A0A05',
        },
        userMessageBackground: '#f0eee6',
        userMessageText: '#000000',
        agentMessageText: '#000000',
        agentEventText: '#666666',
        syntaxKeyword: '#1d4ed8', syntaxString: '#059669', syntaxComment: '#6b7280',
        syntaxNumber: '#0891b2', syntaxFunction: '#9333ea',
        syntaxBracket1: '#ff6b6b', syntaxBracket2: '#4ecdc4', syntaxBracket3: '#45b7d1',
        syntaxBracket4: '#f7b731', syntaxBracket5: '#5f27cd', syntaxDefault: '#374151',
        gitBranchText: '#6b7280', gitFileCountText: '#6b7280',
        gitAddedText: '#22c55e', gitRemovedText: '#ef4444',
        terminal: {
            background: '#1E1E1E', prompt: '#34C759', command: '#E0E0E0',
            stdout: '#E0E0E0', stderr: '#FFB86C', error: '#FF5555', emptyOutput: '#6272A4',
        },
    },
    ...sharedSpacing,
};

// ─── Dark ─────────────────────────────────────────────────────────────────────
export const darkTheme = {
    dark: true,
    colors: {
        text: '#ffffff',
        textDestructive: Platform.select({ ios: '#FF453A', default: '#F48FB1' }),
        textSecondary: Platform.select({ ios: '#8E8E93', default: '#CAC4D0' }),
        textLink: '#2BACCC',
        deleteAction: '#FF6B6B',
        warningCritical: '#FF453A',
        warning: '#8E8E93',
        success: '#32D74B',
        surface: Platform.select({ ios: '#18171C', default: '#212121' }),
        surfaceRipple: 'rgba(255, 255, 255, 0.08)',
        surfacePressed: '#2C2C2E',
        surfaceSelected: '#2C2C2E',
        surfacePressedOverlay: Platform.select({ ios: '#2C2C2E', default: 'transparent' }),
        surfaceHigh: Platform.select({ ios: '#2C2C2E', default: '#171717' }),
        surfaceHighest: Platform.select({ ios: '#38383A', default: '#292929' }),
        divider: Platform.select({ ios: '#38383A', default: '#292929' }),
        shadow: {
            color: Platform.select({ default: '#000000', web: 'rgba(0, 0, 0, 0.1)' }),
            opacity: 0.1,
        },
        header: {
            background: Platform.select({ ios: '#18171C', default: '#212121' }),
            tint: '#ffffff',
        },
        switch: {
            track: {
                active: Platform.select({ ios: '#34C759', default: '#1976D2' }),
                inactive: '#3a393f',
            },
            thumb: { active: '#FFFFFF', inactive: '#767577' },
        },
        groupped: {
            background: Platform.select({ ios: '#1C1C1E', default: '#1e1e1e' }),
            chevron: Platform.select({ ios: '#48484A', default: '#CAC4D0' }),
            sectionTitle: Platform.select({ ios: '#8E8E93', default: '#CAC4D0' }),
        },
        fab: { background: '#FFFFFF', backgroundPressed: '#f0f0f0', icon: '#000000' },
        radio: { active: '#0A84FF', inactive: '#48484A', dot: '#0A84FF' },
        modal: { border: 'rgba(255, 255, 255, 0.1)' },
        button: {
            primary: { background: '#FFFFFF', tint: '#000000', disabled: '#555555' },
            secondary: { tint: '#8E8E93' },
        },
        input: {
            background: Platform.select({ ios: '#1C1C1E', default: '#303030' }),
            text: '#FFFFFF',
            placeholder: '#8E8E93',
        },
        box: {
            warning: { background: 'rgba(255, 159, 10, 0.15)', border: '#FF9F0A', text: '#FFAB00' },
            error: { background: 'rgba(255, 69, 58, 0.15)', border: '#FF453A', text: '#FF6B6B' },
        },
        status: {
            connected: '#34C759',
            connecting: '#FFFFFF',
            disconnected: '#8E8E93',
            error: '#FF453A',
            default: '#8E8E93',
        },
        permission: {
            default: '#8E8E93',
            acceptEdits: '#0A84FF',
            bypass: '#FF9F0A',
            plan: '#32D74B',
            readOnly: '#98989D',
            safeYolo: '#FF7A4C',
            yolo: '#FF453A',
        },
        permissionButton: {
            allow: { background: '#32D74B', text: '#FFFFFF' },
            deny: { background: '#FF453A', text: '#FFFFFF' },
            allowAll: { background: '#0A84FF', text: '#FFFFFF' },
            inactive: { background: '#2C2C2E', border: '#38383A', text: '#8E8E93' },
            selected: { background: '#1C1C1E', border: '#38383A', text: '#FFFFFF' },
        },
        diff: {
            outline: '#30363D',
            success: '#3FB950',
            error: '#F85149',
            addedBg: '#0D2E1F', addedBorder: '#3FB950', addedText: '#C9D1D9',
            removedBg: '#3F1B23', removedBorder: '#F85149', removedText: '#C9D1D9',
            contextBg: '#161B22', contextText: '#8B949E',
            lineNumberBg: '#161B22', lineNumberText: '#6E7681',
            hunkHeaderBg: '#161B22', hunkHeaderText: '#58A6FF',
            leadingSpaceDot: '#2A2A2A',
            inlineAddedBg: '#2A5A2A', inlineAddedText: '#7AFF7A',
            inlineRemovedBg: '#5A2A2A', inlineRemovedText: '#FF7A7A',
        },
        userMessageBackground: '#2C2C2E',
        userMessageText: '#FFFFFF',
        agentMessageText: '#FFFFFF',
        agentEventText: '#8E8E93',
        syntaxKeyword: '#569CD6', syntaxString: '#CE9178', syntaxComment: '#6A9955',
        syntaxNumber: '#B5CEA8', syntaxFunction: '#DCDCAA',
        syntaxBracket1: '#FFD700', syntaxBracket2: '#DA70D6', syntaxBracket3: '#179FFF',
        syntaxBracket4: '#FF8C00', syntaxBracket5: '#00FF00', syntaxDefault: '#D4D4D4',
        gitBranchText: '#8E8E93', gitFileCountText: '#8E8E93',
        gitAddedText: '#34C759', gitRemovedText: '#FF453A',
        terminal: {
            background: '#1E1E1E', prompt: '#32D74B', command: '#E0E0E0',
            stdout: '#E0E0E0', stderr: '#FFB86C', error: '#FF6B6B', emptyOutput: '#7B7B93',
        },
    },
    ...sharedSpacing,
} satisfies typeof lightTheme;

// ─── AMOLED Black ─────────────────────────────────────────────────────────────
// Near-black — uses #000 for surfaces, slight contrast between layers
export const amoledBlackTheme = {
    ...darkTheme,
    dark: true,
    colors: {
        ...darkTheme.colors,
        surface: '#000000',
        surfaceHigh: '#0A0A0A',
        surfaceHighest: '#111111',
        surfacePressed: '#181818',
        surfaceSelected: '#181818',
        surfacePressedOverlay: '#181818',
        divider: '#1A1A1A',
        groupped: { background: '#000000', chevron: '#333333', sectionTitle: '#666666' },
        header: { background: '#000000', tint: '#ffffff' },
        input: { background: '#0D0D0D', text: '#FFFFFF', placeholder: '#555555' },
        userMessageBackground: '#0D0D0D',
        button: {
            primary: { background: '#FFFFFF', tint: '#000000', disabled: '#333333' },
            secondary: { tint: '#666666' },
        },
        modal: { border: 'rgba(255, 255, 255, 0.08)' },
        terminal: { ...darkTheme.colors.terminal, background: '#000000' },
    },
} satisfies typeof lightTheme;

// ─── Super AMOLED Black ───────────────────────────────────────────────────────
// True pitch black — every surface is #000000, zero grey, maximum OLED savings
export const superAmoledBlackTheme = {
    ...darkTheme,
    dark: true,
    colors: {
        ...darkTheme.colors,
        surface: '#000000',
        surfaceHigh: '#000000',
        surfaceHighest: '#050505',
        surfacePressed: '#0F0F0F',
        surfaceSelected: '#0F0F0F',
        surfacePressedOverlay: '#0F0F0F',
        surfaceRipple: 'rgba(255,255,255,0.05)',
        divider: '#111111',
        groupped: { background: '#000000', chevron: '#2A2A2A', sectionTitle: '#555555' },
        header: { background: '#000000', tint: '#ffffff' },
        input: { background: '#000000', text: '#FFFFFF', placeholder: '#444444' },
        userMessageBackground: '#050505',
        button: {
            primary: { background: '#FFFFFF', tint: '#000000', disabled: '#222222' },
            secondary: { tint: '#555555' },
        },
        fab: { background: '#FFFFFF', backgroundPressed: '#CCCCCC', icon: '#000000' },
        modal: { border: 'rgba(255, 255, 255, 0.06)' },
        terminal: { ...darkTheme.colors.terminal, background: '#000000' },
        text: '#EEEEEE',
        textSecondary: '#777777',
    },
} satisfies typeof lightTheme;

// ─── Charcoal ─────────────────────────────────────────────────────────────────
// Deep charcoal — very dark but warmer than pure black
export const charcoalTheme = {
    ...darkTheme,
    dark: true,
    colors: {
        ...darkTheme.colors,
        surface: '#141414',
        surfaceHigh: '#1C1C1C',
        surfaceHighest: '#242424',
        surfacePressed: '#2A2A2A',
        surfaceSelected: '#2A2A2A',
        surfacePressedOverlay: '#2A2A2A',
        divider: '#2A2A2A',
        groupped: { background: '#141414', chevron: '#3A3A3A', sectionTitle: '#707070' },
        header: { background: '#141414', tint: '#F0F0F0' },
        input: { background: '#1C1C1C', text: '#F0F0F0', placeholder: '#666666' },
        userMessageBackground: '#1C1C1C',
        button: {
            primary: { background: '#E0E0E0', tint: '#141414', disabled: '#3A3A3A' },
            secondary: { tint: '#888888' },
        },
        modal: { border: 'rgba(255,255,255,0.08)' },
        terminal: { ...darkTheme.colors.terminal, background: '#0E0E0E' },
    },
} satisfies typeof lightTheme;

// ─── Dark Grey ────────────────────────────────────────────────────────────────
// iOS-style dark grey — matches Apple's system dark UI
export const greyTheme = {
    ...darkTheme,
    dark: true,
    colors: {
        ...darkTheme.colors,
        surface: '#1C1C1E',
        surfaceHigh: '#2C2C2E',
        surfaceHighest: '#3A3A3C',
        surfacePressed: '#3A3A3C',
        surfaceSelected: '#3A3A3C',
        surfacePressedOverlay: '#3A3A3C',
        divider: '#38383A',
        groupped: { background: '#1C1C1E', chevron: '#48484A', sectionTitle: '#8E8E93' },
        header: { background: '#1C1C1E', tint: '#FFFFFF' },
        input: { background: '#2C2C2E', text: '#FFFFFF', placeholder: '#636366' },
        userMessageBackground: '#2C2C2E',
        fab: { background: '#636366', backgroundPressed: '#48484A', icon: '#FFFFFF' },
        button: {
            primary: { background: '#636366', tint: '#FFFFFF', disabled: '#3A3A3C' },
            secondary: { tint: '#8E8E93' },
        },
        radio: { active: '#8E8E93', inactive: '#48484A', dot: '#FFFFFF' },
        modal: { border: 'rgba(255,255,255,0.1)' },
    },
} satisfies typeof lightTheme;

// ─── Steel Grey ───────────────────────────────────────────────────────────────
// Medium steel — between dark grey and light grey
export const steelGreyTheme = {
    ...darkTheme,
    dark: true,
    colors: {
        ...darkTheme.colors,
        surface: '#2A2D33',
        surfaceHigh: '#32363E',
        surfaceHighest: '#3C4149',
        surfacePressed: '#44494F',
        surfaceSelected: '#44494F',
        surfacePressedOverlay: '#44494F',
        divider: '#3C4149',
        text: '#E8EAF0',
        textSecondary: '#9EA3AD',
        groupped: { background: '#2A2D33', chevron: '#5A6070', sectionTitle: '#9EA3AD' },
        header: { background: '#22252B', tint: '#E8EAF0' },
        input: { background: '#32363E', text: '#E8EAF0', placeholder: '#6B7280' },
        userMessageBackground: '#32363E',
        fab: { background: '#9EA3AD', backgroundPressed: '#7A8090', icon: '#FFFFFF' },
        button: {
            primary: { background: '#9EA3AD', tint: '#FFFFFF', disabled: '#3C4149' },
            secondary: { tint: '#9EA3AD' },
        },
        modal: { border: 'rgba(200,210,220,0.12)' },
        terminal: { ...darkTheme.colors.terminal, background: '#1E2128' },
    },
} satisfies typeof lightTheme;

// ─── Light Grey ───────────────────────────────────────────────────────────────
// Clean silver-grey light theme
export const lightGreyTheme = {
    ...lightTheme,
    dark: false,
    colors: {
        ...lightTheme.colors,
        surface: '#F5F5F7',
        surfaceHigh: '#EBEBED',
        surfaceHighest: '#E0E0E3',
        surfacePressed: '#D8D8DB',
        surfaceSelected: '#D8D8DB',
        divider: '#DCDCDF',
        groupped: { background: '#EBEBED', chevron: '#8E8E93', sectionTitle: '#6D6D72' },
        header: { background: '#F5F5F7', tint: '#1C1C1E' },
        input: { background: '#E5E5E8', text: '#1C1C1E', placeholder: '#8E8E93' },
        button: {
            primary: { background: '#3A3A3C', tint: '#FFFFFF', disabled: '#C0C0C3' },
            secondary: { tint: '#6D6D72' },
        },
        fab: { background: '#3A3A3C', backgroundPressed: '#1C1C1E', icon: '#FFFFFF' },
        userMessageBackground: '#E0E0E3',
        userMessageText: '#1C1C1E',
    },
} satisfies typeof lightTheme;

// ─── Dark Blue ────────────────────────────────────────────────────────────────
// Deep navy — dark with rich blue tones
export const darkBlueTheme = {
    ...darkTheme,
    dark: true,
    colors: {
        ...darkTheme.colors,
        surface: '#0D1421',
        surfaceHigh: '#131D2E',
        surfaceHighest: '#1A2740',
        surfacePressed: '#1E2D48',
        surfaceSelected: '#1E2D48',
        surfacePressedOverlay: '#1E2D48',
        divider: '#1E2D48',
        groupped: { background: '#0D1421', chevron: '#2A4070', sectionTitle: '#5B7DB1' },
        header: { background: '#0D1421', tint: '#7EB8F7' },
        textLink: '#7EB8F7',
        input: { background: '#131D2E', text: '#D6E8FF', placeholder: '#3A5A8A' },
        userMessageBackground: '#131D2E',
        fab: { background: '#1565C0', backgroundPressed: '#0D47A1', icon: '#FFFFFF' },
        radio: { active: '#5B9BD5', inactive: '#2A4070', dot: '#5B9BD5' },
        button: {
            primary: { background: '#1565C0', tint: '#FFFFFF', disabled: '#1A2740' },
            secondary: { tint: '#5B9BD5' },
        },
        status: {
            connected: '#34C759',
            connecting: '#5B9BD5',
            disconnected: '#3A5A8A',
            error: '#FF453A',
            default: '#3A5A8A',
        },
        modal: { border: 'rgba(91,155,213,0.2)' },
        terminal: { ...darkTheme.colors.terminal, background: '#060D18', prompt: '#5B9BD5' },
    },
} satisfies typeof lightTheme;

// ─── Midnight Blue ────────────────────────────────────────────────────────────
// Deepest blue — almost black with blue undertone, great for OLED
export const midnightBlueTheme = {
    ...darkTheme,
    dark: true,
    colors: {
        ...darkTheme.colors,
        surface: '#03060F',
        surfaceHigh: '#080F20',
        surfaceHighest: '#0E1830',
        surfacePressed: '#162040',
        surfaceSelected: '#162040',
        surfacePressedOverlay: '#162040',
        divider: '#0E1830',
        groupped: { background: '#03060F', chevron: '#1A3060', sectionTitle: '#3A6090' },
        header: { background: '#03060F', tint: '#4A8FD4' },
        textLink: '#4A8FD4',
        text: '#C8DCFF',
        textSecondary: '#3A6090',
        input: { background: '#080F20', text: '#C8DCFF', placeholder: '#1A3060' },
        userMessageBackground: '#080F20',
        fab: { background: '#1A3A80', backgroundPressed: '#0D2060', icon: '#C8DCFF' },
        radio: { active: '#4A8FD4', inactive: '#1A3060', dot: '#4A8FD4' },
        button: {
            primary: { background: '#1A3A80', tint: '#C8DCFF', disabled: '#0E1830' },
            secondary: { tint: '#4A8FD4' },
        },
        status: {
            connected: '#32D74B',
            connecting: '#4A8FD4',
            disconnected: '#1A3060',
            error: '#FF453A',
            default: '#3A6090',
        },
        modal: { border: 'rgba(74,143,212,0.15)' },
        terminal: { ...darkTheme.colors.terminal, background: '#000308', prompt: '#4A8FD4' },
    },
} satisfies typeof lightTheme;

// ─── Light Blue ───────────────────────────────────────────────────────────────
export const lightBlueTheme = {
    ...lightTheme,
    dark: false,
    colors: {
        ...lightTheme.colors,
        surface: '#F0F7FF',
        surfaceHigh: '#E3F0FF',
        surfaceHighest: '#D6E8FF',
        surfacePressed: '#C9E1FF',
        surfaceSelected: '#C9E1FF',
        divider: '#BDD8F5',
        groupped: { background: '#E8F4FF', chevron: '#5B9BD5', sectionTitle: '#2980B9' },
        header: { background: '#E3F0FF', tint: '#1565C0' },
        textLink: '#1565C0',
        input: { background: '#E3F0FF', text: '#0D1421', placeholder: '#5B9BD5' },
        button: {
            primary: { background: '#1565C0', tint: '#FFFFFF', disabled: '#BDD8F5' },
            secondary: { tint: '#2980B9' },
        },
        fab: { background: '#1565C0', backgroundPressed: '#0D47A1', icon: '#FFFFFF' },
        radio: { active: '#1565C0', inactive: '#BDD8F5', dot: '#1565C0' },
        status: {
            connected: '#34C759',
            connecting: '#1565C0',
            disconnected: '#5B9BD5',
            error: '#FF3B30',
            default: '#5B9BD5',
        },
        userMessageBackground: '#D6E8FF',
        userMessageText: '#0D1421',
    },
} satisfies typeof lightTheme;

// ─── Dark Green ───────────────────────────────────────────────────────────────
// Deep forest / terminal green
export const darkGreenTheme = {
    ...darkTheme,
    dark: true,
    colors: {
        ...darkTheme.colors,
        surface: '#091410',
        surfaceHigh: '#0F1E18',
        surfaceHighest: '#162A22',
        surfacePressed: '#1E3A2E',
        surfaceSelected: '#1E3A2E',
        surfacePressedOverlay: '#1E3A2E',
        divider: '#162A22',
        groupped: { background: '#091410', chevron: '#1A4030', sectionTitle: '#3A8060' },
        header: { background: '#091410', tint: '#4AE090' },
        textLink: '#4AE090',
        text: '#C8FFE0',
        textSecondary: '#3A8060',
        input: { background: '#0F1E18', text: '#C8FFE0', placeholder: '#1A4030' },
        userMessageBackground: '#0F1E18',
        fab: { background: '#1A6040', backgroundPressed: '#0D4028', icon: '#C8FFE0' },
        radio: { active: '#4AE090', inactive: '#1A4030', dot: '#4AE090' },
        button: {
            primary: { background: '#1A6040', tint: '#C8FFE0', disabled: '#162A22' },
            secondary: { tint: '#4AE090' },
        },
        status: {
            connected: '#4AE090',
            connecting: '#34C759',
            disconnected: '#1A4030',
            error: '#FF453A',
            default: '#3A8060',
        },
        modal: { border: 'rgba(74,224,144,0.15)' },
        terminal: { ...darkTheme.colors.terminal, background: '#020A06', prompt: '#4AE090' },
    },
} satisfies typeof lightTheme;

// ─── Dark Purple ──────────────────────────────────────────────────────────────
// Deep violet / indigo
export const darkPurpleTheme = {
    ...darkTheme,
    dark: true,
    colors: {
        ...darkTheme.colors,
        surface: '#0E0A1A',
        surfaceHigh: '#160F28',
        surfaceHighest: '#1E1638',
        surfacePressed: '#2A1E50',
        surfaceSelected: '#2A1E50',
        surfacePressedOverlay: '#2A1E50',
        divider: '#1E1638',
        groupped: { background: '#0E0A1A', chevron: '#3A2870', sectionTitle: '#7A60B0' },
        header: { background: '#0E0A1A', tint: '#C090FF' },
        textLink: '#C090FF',
        text: '#EAD8FF',
        textSecondary: '#7A60B0',
        input: { background: '#160F28', text: '#EAD8FF', placeholder: '#3A2870' },
        userMessageBackground: '#160F28',
        fab: { background: '#5A30A0', backgroundPressed: '#3A1A80', icon: '#EAD8FF' },
        radio: { active: '#C090FF', inactive: '#3A2870', dot: '#C090FF' },
        button: {
            primary: { background: '#5A30A0', tint: '#EAD8FF', disabled: '#1E1638' },
            secondary: { tint: '#C090FF' },
        },
        status: {
            connected: '#32D74B',
            connecting: '#C090FF',
            disconnected: '#3A2870',
            error: '#FF453A',
            default: '#7A60B0',
        },
        modal: { border: 'rgba(192,144,255,0.15)' },
        terminal: { ...darkTheme.colors.terminal, background: '#070412', prompt: '#C090FF' },
    },
} satisfies typeof lightTheme;

// ─── Dark Red / Crimson ───────────────────────────────────────────────────────
export const darkRedTheme = {
    ...darkTheme,
    dark: true,
    colors: {
        ...darkTheme.colors,
        surface: '#160808',
        surfaceHigh: '#220D0D',
        surfaceHighest: '#301414',
        surfacePressed: '#3E1A1A',
        surfaceSelected: '#3E1A1A',
        surfacePressedOverlay: '#3E1A1A',
        divider: '#301414',
        groupped: { background: '#160808', chevron: '#6A2020', sectionTitle: '#A04040' },
        header: { background: '#160808', tint: '#FF8080' },
        textLink: '#FF8080',
        text: '#FFD8D8',
        textSecondary: '#A04040',
        input: { background: '#220D0D', text: '#FFD8D8', placeholder: '#6A2020' },
        userMessageBackground: '#220D0D',
        fab: { background: '#8B1A1A', backgroundPressed: '#6A1010', icon: '#FFD8D8' },
        radio: { active: '#FF8080', inactive: '#6A2020', dot: '#FF8080' },
        button: {
            primary: { background: '#8B1A1A', tint: '#FFD8D8', disabled: '#301414' },
            secondary: { tint: '#FF8080' },
        },
        status: {
            connected: '#32D74B',
            connecting: '#FF8080',
            disconnected: '#6A2020',
            error: '#FF453A',
            default: '#A04040',
        },
        modal: { border: 'rgba(255,128,128,0.15)' },
        terminal: { ...darkTheme.colors.terminal, background: '#0A0202', prompt: '#FF8080' },
    },
} satisfies typeof lightTheme;

export type Theme = typeof lightTheme;
