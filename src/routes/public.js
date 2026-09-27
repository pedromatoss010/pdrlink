const express = require('express');
const pool = require('../db');

const router = express.Router();

function isOpenNow(hoursRow, now) {
  if (!hoursRow || hoursRow.closed) return false;

  const currentTime = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return currentTime >= hoursRow.open_time && currentTime <= hoursRow.close_time;
}

router.get('/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const userResult = await pool.query(
      'SELECT id, username, display_name, bio, account_type, avatar_url FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Página não encontrada' });
    }

    const user = userResult.rows[0];

    const linksResult = await pool.query(
      'SELECT id, title, url, icon_url FROM links WHERE user_id = $1 ORDER BY position ASC',
      [user.id]
    );

    const now = new Date();
    const dayOfWeek = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDay();

    const hoursResult = await pool.query(
      'SELECT open_time, close_time, closed FROM business_hours WHERE user_id = $1 AND day_of_week = $2',
      [user.id, dayOfWeek]
    );

    const todayHours = hoursResult.rows[0] || null;
    const open = isOpenNow(todayHours, now);

    res.json({
      username: user.username,
      display_name: user.display_name,
      bio: user.bio,
      account_type: user.account_type,
      avatar_url: user.avatar_url,
      links: linksResult.rows,
      is_open_now: open,
      today_hours: todayHours
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar página' });
  }
});

module.exports = router;