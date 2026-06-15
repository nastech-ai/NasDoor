/**
 * server.tsx — iOS: Connect to NasTech Server
 *
 * On iOS, the NasTech daemon does not run locally.
 * This screen lets the user connect to a remote NasTech server
 * (e.g. a Mac, Linux box, or Android device running the daemon).
 */
import * as React from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    Platform, KeyboardAvoidingView, ScrollView, Alert,
} from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { Stack, useRouter } from 'expo-router';
import { getServerUrl, setServerUrl, validateServerUrl, isUsingCustomServer } from '@/sync/serverConfig';
import { Ionicons } from '@expo/vector-icons';

export default function ServerScreen() {
    const { theme } = useUnistyles();
    const router = useRouter();
    const [url, setUrl] = React.useState(getServerUrl());
    const [error, setError] = React.useState<string | null>(null);
    const [saved, setSaved] = React.useState(false);
    const isCustom = isUsingCustomServer();

    const handleSave = () => {
        setError(null);
        const validation = validateServerUrl(url);
        if (!validation.valid) {
            setError(validation.error ?? 'Invalid URL');
            return;
        }
        setServerUrl(url);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleReset = () => {
        Alert.alert(
            'Reset Server',
            'Reset to default server URL (127.0.0.1:9119)?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: () => {
                        setServerUrl(null);
                        setUrl('http://127.0.0.1:9119');
                    },
                },
            ]
        );
    };

    return (
        <>
            <Stack.Screen options={{ title: 'Server Connection' }} />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    style={{ flex: 1, backgroundColor: theme.colors.groupped.background }}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Info banner for iOS */}
                    {Platform.OS === 'ios' && (
                        <View style={[styles.infoBanner, { backgroundColor: theme.colors.box?.warning?.background ?? 'rgba(255,159,10,0.12)', borderColor: theme.colors.box?.warning?.border ?? '#FF9F0A' }]}>
                            <Ionicons name="information-circle-outline" size={20} color={theme.colors.box?.warning?.text ?? '#FF9F0A'} />
                            <Text style={[styles.infoText, { color: theme.colors.box?.warning?.text ?? '#FF9F0A' }]}>
                                On iPhone, NasTech connects to an external server. Run the NasTech daemon on a Mac, Linux box, or Android device, then enter its URL below.
                            </Text>
                        </View>
                    )}

                    <Text style={[styles.sectionTitle, { color: theme.colors.groupped.sectionTitle }]}>
                        SERVER URL
                    </Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                        <TextInput
                            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.divider }]}
                            value={url}
                            onChangeText={t => { setUrl(t); setError(null); setSaved(false); }}
                            placeholder="http://192.168.1.x:9119"
                            placeholderTextColor={theme.colors.input.placeholder}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                            returnKeyType="done"
                            onSubmitEditing={handleSave}
                        />

                        {error && (
                            <Text style={[styles.errorText, { color: theme.colors.status.error }]}>{error}</Text>
                        )}

                        <TouchableOpacity
                            style={[styles.saveBtn, { backgroundColor: theme.colors.button.primary.background }]}
                            onPress={handleSave}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.saveBtnText, { color: theme.colors.button.primary.tint }]}>
                                {saved ? '✓ Saved' : 'Connect'}
                            </Text>
                        </TouchableOpacity>

                        {isCustom && (
                            <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
                                <Text style={[styles.resetBtnText, { color: theme.colors.status.error }]}>
                                    Reset to default
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
                        The NasTech AI daemon serves the REST API on port 9119. Make sure the server is reachable from this device.
                    </Text>

                </ScrollView>
            </KeyboardAvoidingView>
        </>
    );
}

const styles = StyleSheet.create({
    content: { padding: 16, paddingTop: 24 },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 14,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 20,
    },
    infoText: { flex: 1, fontSize: 14, lineHeight: 20 },
    sectionTitle: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginLeft: 4 },
    card: { borderRadius: 12, padding: 16, marginBottom: 12 },
    input: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        fontFamily: 'SpaceMono',
        marginBottom: 12,
    },
    errorText: { fontSize: 13, marginBottom: 10 },
    saveBtn: {
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginBottom: 8,
    },
    saveBtnText: { fontSize: 16, fontWeight: '600' },
    resetBtn: { alignItems: 'center', paddingVertical: 8 },
    resetBtnText: { fontSize: 14 },
    hint: { fontSize: 13, lineHeight: 18, marginTop: 4, marginHorizontal: 4 },
});
