// frontend/sync-env.js
// Automatically imports environment variables from the global root .env into frontend/.env.local
// This ensures secret keys are never committed to git or written to .env.development / .env.production.

const fs = require('fs');
const path = require('path');

const rootEnvPath = path.resolve(__dirname, '../.env');
const localEnvPath = path.resolve(__dirname, '.env.local');

function syncEnv() {
    if (!fs.existsSync(rootEnvPath)) {
        console.log('[sync-env] Global root .env not found at', rootEnvPath);
        return;
    }

    try {
        const rootContent = fs.readFileSync(rootEnvPath, 'utf8');
        const lines = rootContent.split('\n');

        let apiKey = '';
        let voice = 'Daniel';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

            const eqIdx = trimmed.indexOf('=');
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');

            const lower = key.toLowerCase();
            if (lower === 'react_app_unrealspeech_api_key' || lower === 'unrealspeech' || lower === 'unrealspeech_api_key') {
                if (val && !apiKey) apiKey = val;
            }
            if (lower === 'react_app_unrealspeech_voice' || lower === 'unrealspeech_voice') {
                if (val) voice = val;
            }
        }

        if (apiKey) {
            let existing = '';
            if (fs.existsSync(localEnvPath)) {
                existing = fs.readFileSync(localEnvPath, 'utf8');
            }

            // Parse existing lines to preserve other local keys if any
            const keptLines = existing
                .split('\n')
                .filter(l => {
                    const t = l.trim();
                    return !t.startsWith('REACT_APP_UNREALSPEECH_API_KEY=') && !t.startsWith('REACT_APP_UNREALSPEECH_VOICE=');
                })
                .join('\n')
                .trim();

            const newContent = `${keptLines ? keptLines + '\n' : ''}# Auto-imported from global root .env (gitignored)\nREACT_APP_UNREALSPEECH_API_KEY=${apiKey}\nREACT_APP_UNREALSPEECH_VOICE=${voice}\n`;

            fs.writeFileSync(localEnvPath, newContent, 'utf8');
            console.log('[sync-env] ✓ Imported UnrealSpeech TTS key from root .env to frontend/.env.local');
        } else {
            console.log('[sync-env] No UnrealSpeech key found in root .env');
        }
    } catch (err) {
        console.warn('[sync-env] Failed to sync root .env:', err.message);
    }
}

syncEnv();
