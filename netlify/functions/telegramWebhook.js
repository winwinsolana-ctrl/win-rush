/* Netlify Function: Telegram bot webhook for the "winrushturbo" Game.
   Handles two things BotFather's /newgame flow deliberately leaves out:

   1) When someone messages the bot, reply with the game itself
      (Bot API: sendGame).
   2) When someone taps the game's "Play" button, Telegram sends a
      callback_query with game_short_name set — we must answer it with
      the *actual* game URL (Bot API: answerCallbackQuery, `url` field).
      This is the only place the real URL is ever provided; BotFather
      has no "Game URL" setting because of this.

   Required environment variable (already set for setGameScore.js):
     TELEGRAM_BOT_TOKEN

   One-time setup after deploying: register this function as the bot's
   webhook (see README for the exact URL to paste in your own browser —
   do this yourself, don't share your bot token with anyone). */

const GAME_SHORT_NAME = 'winrushturbo';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, body: 'ok' };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not set');
    return { statusCode: 200, body: 'ok' };
  }
  const api = `https://api.telegram.org/bot${token}`;

  let update;
  try {
    update = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 200, body: 'ok' };
  }

  const host = event.headers['x-forwarded-host'] || event.headers.host;
  const gameUrlBase = `https://${host}/index.html`;

  try {
    // 1) Any message (e.g. /start, or just "hi") -> send the game
    if (update.message) {
      await fetch(`${api}/sendGame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: update.message.chat.id,
          game_short_name: GAME_SHORT_NAME
        })
      });
    }

    // 2) "Play" button tapped -> answer with the real, parameterized URL
    if (update.callback_query && update.callback_query.game_short_name === GAME_SHORT_NAME) {
      const cq = update.callback_query;
      const params = new URLSearchParams({ user_id: String(cq.from.id) });

      if (cq.inline_message_id) {
        params.set('inline_message_id', cq.inline_message_id);
      } else if (cq.message) {
        params.set('chat_id', String(cq.message.chat.id));
        params.set('message_id', String(cq.message.message_id));
      }

      const gameUrl = `${gameUrlBase}?${params.toString()}`;

      await fetch(`${api}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cq.id, url: gameUrl })
      });
    }
  } catch (err) {
    console.error('Webhook handling failed', err);
  }

  // Telegram just needs a fast 200 OK — it doesn't read the body.
  return { statusCode: 200, bod
    y: 'ok' };
};
