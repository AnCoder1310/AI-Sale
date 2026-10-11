# Practice Room Voice Mode

Voice Mode is optional. Advisors can switch between **Chế độ chữ** and **Chế độ nói** inside the same Practice session. In Voice Mode, hold the microphone button, speak Vietnamese for up to 60 seconds, release, review or edit the recognized text, and press **Gửi**. The existing `/practice/{session_id}/message` path drives the LangGraph customer, checkpoint, transcript, and evaluation exactly as it does in Text Mode. The customer reply can play automatically or from its **Phát giọng khách** button. The advisor can choose a Vietnamese female (`vi-VN-Wavenet-A`) or male (`vi-VN-Wavenet-B`) customer voice. Browser autoplay restrictions may require clicking the playback button.

## Backend configuration

Set these only on the backend (Render secret environment settings in a hosted deployment, or an untracked local `.env` for Docker):

```text
GROQ_API_KEY=<Groq API key>
GOOGLE_TTS_SERVICE_ACCOUNT_JSON=<single-line service-account JSON secret>
VOICE_STT_USD_PER_HOUR=0.04
VOICE_TTS_USD_PER_MILLION_CHARACTERS=16
```

Enable Google Cloud Text-to-Speech and billing in the Google project. Grant the backend identity only the access needed to synthesize speech. The Google client also accepts Application Default Credentials; for an external host, workload identity federation avoids a long-lived service-account key where available. If using the JSON secret on Render, keep the full value in Render only. Do not put either provider credential in Vercel, frontend code, Git, or logs. Both providers are optional for Text Mode, but both must be configured for the complete voice experience. The app returns an explicit service error if one is missing.

The browser sends compressed audio through the existing same-origin `/api` proxy. It is capped at 4 MB, below the documented Vercel function payload limit. The backend rejects unsupported types and larger uploads, then sends a non-streaming transcription request to Groq Whisper Large V3 Turbo with `language=vi`. It does not save recordings. A recognized transcript is not persisted until the advisor confirms it with **Gửi**. The TTS endpoint only synthesizes a customer message ID already present in an advisor-owned session; it never accepts arbitrary text from the browser.

The `practice_voice_usage` SQL table records each successful STT or TTS call with its session ID, provider, billable seconds or characters, and estimated USD. It does not contain audio, transcript text, or credentials. The manager review modal shows per-session usage and estimated cost through the manager-only `/manager/reviews/{session_id}/voice/usage` endpoint. Advisors cannot access these figures. Groq's documented minimum billed STT length is 10 seconds. The estimates use configurable list rates and do not account for free quotas, taxes, or future price changes; verify provider invoices for actual charges. SQL tables are created lazily, as with the existing Practice tables. There is no schema migration system yet.

## Failure and retry behavior

- Denied microphone permission, missing browser recording support, empty audio, or interrupted recording leaves the current Practice turn unchanged.
- A failed transcription shows a retry message. A recognized transcript can be edited before the usual send action. Empty recognized speech is counted as an STT call but does not advance the role-play.
- A failed customer TTS call does not roll back the already saved customer reply. The advisor can retry playback or continue in Text Mode.
- Customer audio is cached only in the current browser view for replay, then released when leaving the room. Recording audio is not written to the database.

The recording hook has one output boundary: an audio `Blob` and duration passed to the transcription action. A future browser Silero VAD can produce a compatible blob and call that same action while retaining the Push-to-Talk control. VAD is not installed in this phase.

Provider references: [Groq speech to text](https://console.groq.com/docs/speech-to-text), [Google Cloud TTS setup](https://docs.cloud.google.com/text-to-speech/docs/get-started), [Vietnamese WaveNet voices](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types), [Google TTS pricing](https://cloud.google.com/text-to-speech/pricing), [Vercel upload limit](https://vercel.com/docs/errors/function_payload_too_large), [future browser VAD hook](https://docs.vad.ricky0123.com/user-guide/react/).
