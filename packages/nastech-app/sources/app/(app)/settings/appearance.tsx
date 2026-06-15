import { Ionicons } from '@expo/vector-icons';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { useSettingMutable, useLocalSettingMutable } from '@/sync/storage';
import { useRouter } from 'expo-router';
import * as Localization from 'expo-localization';
import { useUnistyles, UnistylesRuntime } from 'react-native-unistyles';
import { Switch } from '@/components/Switch';
import { Appearance, Platform } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { darkTheme, lightTheme, amoledBlackTheme, darkBlueTheme, lightBlueTheme, greyTheme } from '@/theme';
import { t, getLanguageNativeName, SUPPORTED_LANGUAGES } from '@/text';
import { THEME_NAMES, AppThemeName } from '@/unistyles';
import type { ThemePreference } from '@/sync/localSettings';

type KnownAvatarStyle = 'pixelated' | 'gradient' | 'brutalist';

const isKnownAvatarStyle = (style: string): style is KnownAvatarStyle => {
    return style === 'pixelated' || style === 'gradient' || style === 'brutalist';
};

const themeObjects: Record<AppThemeName, typeof lightTheme> = {
    light: lightTheme,
    dark: darkTheme,
    amoledBlack: amoledBlackTheme,
    darkBlue: darkBlueTheme,
    lightBlue: lightBlueTheme,
    grey: greyTheme,
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

export default function AppearanceSettingsScreen() {
    const { theme } = useUnistyles();
    const router = useRouter();
    const [viewInline, setViewInline] = useSettingMutable('viewInline');
    const [expandTodos, setExpandTodos] = useSettingMutable('expandTodos');
    const [showLineNumbers, setShowLineNumbers] = useSettingMutable('showLineNumbers');
    const [showLineNumbersInToolViews, setShowLineNumbersInToolViews] = useSettingMutable('showLineNumbersInToolViews');
    const [wrapLinesInDiffs, setWrapLinesInDiffs] = useSettingMutable('wrapLinesInDiffs');
    const [diffStyle, setDiffStyle] = useSettingMutable('diffStyle');
    const [alwaysShowContextSize, setAlwaysShowContextSize] = useSettingMutable('alwaysShowContextSize');
    const [avatarStyle, setAvatarStyle] = useSettingMutable('avatarStyle');
    const [showFlavorIcons, setShowFlavorIcons] = useSettingMutable('showFlavorIcons');
    const [themePreference, setThemePreference] = useLocalSettingMutable('themePreference');
    const [preferredLanguage] = useSettingMutable('preferredLanguage');

    const displayStyle: KnownAvatarStyle = isKnownAvatarStyle(avatarStyle) ? avatarStyle : 'gradient';

    const getLanguageDisplayText = () => {
        if (preferredLanguage === null) {
            const deviceLocale = Localization.getLocales()?.[0]?.languageTag ?? 'en-US';
            const deviceLanguage = deviceLocale.split('-')[0].toLowerCase();
            const detectedLanguageName = deviceLanguage in SUPPORTED_LANGUAGES ?
                getLanguageNativeName(deviceLanguage as keyof typeof SUPPORTED_LANGUAGES) :
                getLanguageNativeName('en');
            return `${t('settingsLanguage.automatic')} (${detectedLanguageName})`;
        } else if (preferredLanguage && preferredLanguage in SUPPORTED_LANGUAGES) {
            return getLanguageNativeName(preferredLanguage as keyof typeof SUPPORTED_LANGUAGES);
        }
        return t('settingsLanguage.automatic');
    };

    const allThemes: { id: ThemePreference; label: string }[] = [
        ...THEME_NAMES,
        { id: 'adaptive', label: 'Adaptive (follows system)' },
    ];

    const currentLabel = allThemes.find(t => t.id === themePreference)?.label ?? themePreference;

    return (
        <ItemList style={{ paddingTop: 0 }}>

            {/* Theme Settings */}
            <ItemGroup title={t('settingsAppearance.theme')} footer="Choose a colour scheme for the app">
                {allThemes.map(({ id, label }) => (
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

            {/* Language Settings */}
            <ItemGroup title={t('settingsLanguage.title')} footer={t('settingsLanguage.description')}>
                <Item
                    title={t('settingsLanguage.currentLanguage')}
                    icon={<Ionicons name="language-outline" size={29} color="#007AFF" />}
                    detail={getLanguageDisplayText()}
                    onPress={() => router.push('/settings/language')}
                />
            </ItemGroup>

            {/* Display Settings */}
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
                    title={t('settingsAppearance.wrapLines')}
                    subtitle={t('settingsAppearance.wrapLinesDescription')}
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
