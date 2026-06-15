import { Ionicons } from '@expo/vector-icons';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { useSettingMutable, useLocalSettingMutable } from '@/sync/storage';
import { useRouter } from 'expo-router';
import * as Localization from 'expo-localization';
import { useUnistyles, UnistylesRuntime } from 'react-native-unistyles';
import { Switch } from '@/components/Switch';
import { Appearance } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import {
    darkTheme, lightTheme,
    amoledBlackTheme, superAmoledBlackTheme, charcoalTheme,
    greyTheme, steelGreyTheme, lightGreyTheme,
    darkBlueTheme, midnightBlueTheme, lightBlueTheme,
    darkGreenTheme, darkPurpleTheme, darkRedTheme,
} from '@/theme';
import { AppThemeName } from '@/unistyles';
import type { ThemePreference } from '@/sync/localSettings';
import { t, getLanguageNativeName, SUPPORTED_LANGUAGES } from '@/text';

const themeObjects: Record<AppThemeName, typeof lightTheme> = {
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

function applyTheme(nextTheme: ThemePreference) {
    if (nextTheme === 'adaptive') {
        UnistylesRuntime.setAdaptiveThemes(true);
        const systemTheme = Appearance.getColorScheme();
        const themeObj = systemTheme === 'dark' ? darkTheme : lightTheme;
        const color = themeObj.colors.groupped.background as string;
        UnistylesRuntime.setRootViewBackgroundColor(color);
        SystemUI.setBackgroundColorAsync(color);
    } else {
        UnistylesRuntime.setAdaptiveThemes(false);
        UnistylesRuntime.setTheme(nextTheme as AppThemeName);
        const themeObj = themeObjects[nextTheme as AppThemeName];
        const color = (themeObj?.colors?.groupped?.background ?? '#000000') as string;
        UnistylesRuntime.setRootViewBackgroundColor(color);
        SystemUI.setBackgroundColorAsync(color);
    }
}

const THEME_GROUPS: { title: string; themes: { id: ThemePreference; label: string }[] }[] = [
    {
        title: 'Black',
        themes: [
            { id: 'superAmoledBlack', label: 'Super AMOLED Black' },
            { id: 'amoledBlack', label: 'AMOLED Black' },
            { id: 'charcoal', label: 'Charcoal' },
            { id: 'dark', label: 'Dark' },
        ],
    },
    {
        title: 'Grey',
        themes: [
            { id: 'grey', label: 'Dark Grey' },
            { id: 'steelGrey', label: 'Steel Grey' },
            { id: 'lightGrey', label: 'Light Grey' },
        ],
    },
    {
        title: 'Blue',
        themes: [
            { id: 'midnightBlue', label: 'Midnight Blue' },
            { id: 'darkBlue', label: 'Dark Blue' },
            { id: 'lightBlue', label: 'Light Blue' },
        ],
    },
    {
        title: 'Colour',
        themes: [
            { id: 'darkGreen', label: 'Dark Green' },
            { id: 'darkPurple', label: 'Dark Purple' },
            { id: 'darkRed', label: 'Dark Red' },
        ],
    },
    {
        title: 'Light',
        themes: [
            { id: 'light', label: 'Light' },
            { id: 'adaptive', label: 'Adaptive (follows system)' },
        ],
    },
];

export default function AppearanceSettingsScreen() {
    const { theme } = useUnistyles();
    const router = useRouter();
    const [viewInline, setViewInline] = useSettingMutable('viewInline');
    const [expandTodos, setExpandTodos] = useSettingMutable('expandTodos');
    const [showLineNumbers, setShowLineNumbers] = useSettingMutable('showLineNumbers');
    const [showLineNumbersInToolViews, setShowLineNumbersInToolViews] = useSettingMutable('showLineNumbersInToolViews');
    const [wrapLinesInDiffs, setWrapLinesInDiffs] = useSettingMutable('wrapLinesInDiffs');
    const [alwaysShowContextSize, setAlwaysShowContextSize] = useSettingMutable('alwaysShowContextSize');
    const [showFlavorIcons, setShowFlavorIcons] = useSettingMutable('showFlavorIcons');
    const [themePreference, setThemePreference] = useLocalSettingMutable('themePreference');
    const [preferredLanguage] = useSettingMutable('preferredLanguage');

    const getLanguageDisplayText = () => {
        if (preferredLanguage === null) {
            const deviceLocale = Localization.getLocales()?.[0]?.languageTag ?? 'en-US';
            const deviceLanguage = deviceLocale.split('-')[0].toLowerCase();
            const detectedLanguageName = deviceLanguage in SUPPORTED_LANGUAGES
                ? getLanguageNativeName(deviceLanguage as keyof typeof SUPPORTED_LANGUAGES)
                : getLanguageNativeName('en');
            return `${t('settingsLanguage.automatic')} (${detectedLanguageName})`;
        } else if (preferredLanguage && preferredLanguage in SUPPORTED_LANGUAGES) {
            return getLanguageNativeName(preferredLanguage as keyof typeof SUPPORTED_LANGUAGES);
        }
        return t('settingsLanguage.automatic');
    };

    return (
        <ItemList style={{ paddingTop: 0 }}>

            {/* Colour Scheme — grouped by family */}
            {THEME_GROUPS.map(group => (
                <ItemGroup key={group.title} title={group.title}>
                    {group.themes.map(({ id, label }) => (
                        <Item
                            key={id}
                            title={label}
                            detail={themePreference === id ? '✓' : ''}
                            onPress={() => {
                                setThemePreference(id);
                                applyTheme(id);
                            }}
                        />
                    ))}
                </ItemGroup>
            ))}

            {/* Language */}
            <ItemGroup title={t('settingsLanguage.title')} footer={t('settingsLanguage.description')}>
                <Item
                    title={t('settingsLanguage.currentLanguage')}
                    icon={<Ionicons name="language-outline" size={29} color="#007AFF" />}
                    detail={getLanguageDisplayText()}
                    onPress={() => router.push('/settings/language')}
                />
            </ItemGroup>

            {/* Display */}
            <ItemGroup title={t('settingsAppearance.display')} footer={t('settingsAppearance.displayDescription')}>
                <Item
                    title={t('settingsAppearance.inlineToolCalls')}
                    subtitle={t('settingsAppearance.inlineToolCallsDescription')}
                    icon={<Ionicons name="code-slash-outline" size={29} color="#5856D6" />}
                    rightElement={<Switch value={viewInline} onValueChange={setViewInline} />}
                />
                <Item
                    title={t('settingsAppearance.expandTodoLists')}
                    subtitle={t('settingsAppearance.expandTodoListsDescription')}
                    icon={<Ionicons name="checkmark-done-outline" size={29} color="#5856D6" />}
                    rightElement={<Switch value={expandTodos} onValueChange={setExpandTodos} />}
                />
                <Item
                    title={t('settingsAppearance.showLineNumbersInDiffs')}
                    subtitle={t('settingsAppearance.showLineNumbersInDiffsDescription')}
                    icon={<Ionicons name="list-outline" size={29} color="#5856D6" />}
                    rightElement={<Switch value={showLineNumbers} onValueChange={setShowLineNumbers} />}
                />
                <Item
                    title={t('settingsAppearance.showLineNumbersInToolViews')}
                    subtitle={t('settingsAppearance.showLineNumbersInToolViewsDescription')}
                    icon={<Ionicons name="list-outline" size={29} color="#5856D6" />}
                    rightElement={<Switch value={showLineNumbersInToolViews} onValueChange={setShowLineNumbersInToolViews} />}
                />
                <Item
                    title={t('settingsAppearance.wrapLinesInDiffs')}
                    subtitle={t('settingsAppearance.wrapLinesInDiffsDescription')}
                    icon={<Ionicons name="arrow-redo-outline" size={29} color="#5856D6" />}
                    rightElement={<Switch value={wrapLinesInDiffs} onValueChange={setWrapLinesInDiffs} />}
                />
                <Item
                    title={t('settingsAppearance.showFlavorIcons')}
                    subtitle={t('settingsAppearance.showFlavorIconsDescription')}
                    icon={<Ionicons name="color-palette-outline" size={29} color="#5856D6" />}
                    rightElement={<Switch value={showFlavorIcons} onValueChange={setShowFlavorIcons} />}
                />
                <Item
                    title={t('settingsAppearance.alwaysShowContextSize')}
                    subtitle={t('settingsAppearance.alwaysShowContextSizeDescription')}
                    icon={<Ionicons name="bar-chart-outline" size={29} color="#5856D6" />}
                    rightElement={<Switch value={alwaysShowContextSize} onValueChange={setAlwaysShowContextSize} />}
                />
                <Item
                    title={t('settingsAppearance.zenMode')}
                    subtitle={t('settingsAppearance.zenModeDescription')}
                    icon={<Ionicons name="eye-off-outline" size={29} color="#5856D6" />}
                    detail={t('settingsAppearance.zenModeDetail')}
                    onPress={() => router.push('/settings/zen-mode')}
                />
            </ItemGroup>

        </ItemList>
    );
}
