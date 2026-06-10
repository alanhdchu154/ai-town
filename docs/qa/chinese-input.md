# Underworld Chinese Input QA

Manual regression for v0.0.9 conversation input:

1. Open `/ai-town` and enter campus as Alan.
2. Select 海 or another nearby character.
3. Click `開始說話`.
4. Type with a Chinese IME: `海，早安。今天我應該先處理什麼？`
5. Confirm composition candidates normally.
6. Press `Shift+Enter` and verify a newline is inserted without sending.
7. Press `Enter` while not composing and verify the exact Chinese text appears in the conversation log.
8. Press `Escape` and verify Alan leaves the conversation.

Expected:
- Chinese characters are preserved.
- Enter does not send while IME composition is active.
- Shift+Enter inserts a newline.
- Escape exits conversation mode.
