export const WELCOME_GOODBYE_MESSAGE_TYPES = ['text', 'embed', 'text_and_embed'] as const;
export type WelcomeGoodbyeMessageTypeApi = (typeof WELCOME_GOODBYE_MESSAGE_TYPES)[number];

/** Discord message content max length */
export const CONTENT_TEXT_MAX_LENGTH = 2000;
/** Discord embed title max length */
export const EMBED_TITLE_MAX_LENGTH = 256;
/** Discord embed description max length */
export const EMBED_DESCRIPTION_MAX_LENGTH = 4096;
/** Discord embed field name max length */
export const EMBED_FIELD_NAME_MAX_LENGTH = 256;
/** Discord embed field value max length */
export const EMBED_FIELD_VALUE_MAX_LENGTH = 1024;
/** Discord embed color valid range */
export const EMBED_COLOR_MIN = 0;
export const EMBED_COLOR_MAX = 0xffffff;
