import { AppSettings, initialSettings, TokenSettings } from "./AppContext";
import * as fs from "fs";
import { getTokenUIDFromPath } from "./Tokens";
import { TokenUID } from "./Types";

export default function migrateSettings(settings: Record<string, any>): AppSettings
{
    if (!settings.version)
    {
        const newTokens: Record<TokenUID, TokenSettings> = {};

        Object.entries(settings.tokens as Record<TokenUID, TokenSettings>).forEach(([tokenPath, tokenSettings]) =>
        {
            const uid = getTokenUIDFromPath(tokenPath);

            if (uid !== null)
            {
                newTokens[uid] = {
                    shortcut: tokenSettings.shortcut ?? "",
                    enabled: true
                };
            }
        });

        return {
            confirmDelete: settings.confirmDelete,
            playNoteOnClick: settings.playNoteOnClick,
            tokenSearchPaths: initialSettings.tokenSearchPaths.slice(0),
            tokens: newTokens,
            version: 1,
            wrapPlayheads: settings.wrapPlayheads
        };
    }

    return settings as AppSettings;
}