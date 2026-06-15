/**
 * NasTech wire protocol types.
 * All schemas are owned locally in sources/nastech-wire — no external dependency.
 */

export {
    MessageMetaSchema,
    SessionMessageContentSchema,
    SessionMessageSchema,
    SessionProtocolMessageSchema,
    MessageContentSchema,
    VersionedEncryptedValueSchema,
    VersionedNullableEncryptedValueSchema,
    VersionedMachineEncryptedValueSchema,
    UpdateNewMessageBodySchema,
    UpdateSessionBodySchema,
    UpdateMachineBodySchema,
    CoreUpdateBodySchema,
    CoreUpdateContainerSchema,
    ApiMessageSchema,
    ApiUpdateNewMessageSchema,
    ApiUpdateSessionStateSchema,
    ApiUpdateMachineStateSchema,
    UpdateBodySchema,
    UpdateSchema,
} from '../nastech-wire/messages';

export type {
    MessageMeta,
    SessionMessageContent,
    SessionMessage,
    SessionProtocolMessage,
    MessageContent,
    VersionedEncryptedValue,
    VersionedNullableEncryptedValue,
    VersionedMachineEncryptedValue,
    UpdateNewMessageBody,
    UpdateSessionBody,
    UpdateMachineBody,
    CoreUpdateBody,
    CoreUpdateContainer,
    ApiMessage,
    ApiUpdateNewMessage,
    ApiUpdateSessionState,
    ApiUpdateMachineState,
    UpdateBody,
    Update,
} from '../nastech-wire/messages';

export {
    UserMessageSchema,
    AgentMessageSchema,
    LegacyMessageContentSchema,
} from '../nastech-wire/legacyProtocol';

export type {
    UserMessage,
    AgentMessage,
    LegacyMessageContent,
} from '../nastech-wire/legacyProtocol';

export {
    sessionRoleSchema,
    sessionTextEventSchema,
    sessionServiceMessageEventSchema,
    sessionToolCallStartEventSchema,
    sessionToolCallEndEventSchema,
    sessionFileEventSchema,
    sessionTurnStartEventSchema,
    sessionStartEventSchema,
    sessionTurnEndStatusSchema,
    sessionTurnEndEventSchema,
    sessionStopEventSchema,
    sessionEventSchema,
    sessionEnvelopeSchema,
    createEnvelope,
} from '../nastech-wire/sessionProtocol';

export type {
    SessionRole,
    SessionEvent,
    SessionTurnEndStatus,
    SessionEnvelope,
    CreateEnvelopeOptions,
} from '../nastech-wire/sessionProtocol';

export {
    VoiceConversationGrantedSchema,
    VoiceConversationDeniedSchema,
    VoiceConversationResponseSchema,
    VoiceUsageResponseSchema,
} from '../nastech-wire/voice';

export type {
    VoiceConversationResponse,
    VoiceUsageResponse,
} from '../nastech-wire/voice';
