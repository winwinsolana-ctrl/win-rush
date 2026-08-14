/* Netlify Function: forwards the final race distance to Telegram's Bot API
   (setGameScore) so it shows up in Telegram's native per-chat Game
   leaderboard. Runs on Netlify's free tier — no Firebase Blaze plan needed,
   and since it's served from the same site as the game, no CORS setup is
   required either.

   Required environment variables (set in Netlify dashboard →
   Site settings → Environment variables, NOT in this file):
     TELEGRAM_BOT_TOKEN   — from BotFather
     GAME_SHARED_SECRET   — any random string, must match the value used
                             in the game's HTML (GAME_SHARED_SECRET)       */

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const providedSecret = event.headers["x-game-secret"];
  if (!providedSecret || providedSecret !== process.env.GAME_SHARED_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { user_id, chat_id, message_id, inline_message_id, score } = payload;

  if (!user_id || typeof score !== "number") {
    return { statusCode: 400, body: JSON.stringify({ error: "user_id and numeric score are required" }) };
  }
  if (!inline_message_id && !(chat_id && message_id)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Provide chat_id+message_id or inline_message_id" }) };
  }

  const params = new URLSearchParams({
    user_id: String(user_id),
    score: String(Math.max(0, Math.floor(score))),
  });
  if (inline_message_id) {
    params.set("inline_message_id", String(inline_message_id));
  } else {
    params.set("chat_id", String(chat_id));
    params.set("message_id", String(message_id));
  }

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setGameScore?${params.toString()}`
    );
    const data = await tgRes.json();
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (err) {
    console.error("setGameScore failed", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Telegram API call failed" }) }
      ;
  }
};
