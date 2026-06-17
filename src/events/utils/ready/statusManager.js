const botConfig = (() => {
  try {
    return require('../../../botConfig.js');
  } catch (e) {
    return {};
  }
})();

module.exports = async (client) => {
  const botName = botConfig?.botName || client.user?.username || 'Bot';
  const prefix = botConfig?.prefix || '!';
  const defaultStatuses = [
    { name: `${prefix}help ile yardım alabilirsiniz`, type: 'LISTENING' },
    { name: `Sorun mu var? ${prefix}bildir kullan `, type: 'PLAYING' },
    { name: `${botName} Hizmetinizde`, type: 'PLAYING' },
    { name: `Komutu anlamadıysan ${prefix}açıkla kullan`, type: 'PLAYING' }
  ];

  client.defaultStatuses = defaultStatuses;

  client.statusLoopId = null;
  client.customLoopId = null;

  client._statusIndex = 0;
  client._customIndex = 0;

  function safeClear(idRefName) {
    try {
      const id = client[idRefName];
      if (id) {
        clearInterval(id);
        client[idRefName] = null;
        return true;
      }
    } catch (e) {}
    return false;
  }

  client.startStatusLoop = (
    statuses = client.defaultStatuses,
    intervalMs = 10000
  ) => {
    try {
      safeClear('customLoopId');
      client._customIndex = 0;

      safeClear('statusLoopId');
      client._statusIndex = 0;

      if (!Array.isArray(statuses) || statuses.length === 0) {
        console.log(
          '[Ready] startStatusLoop: geçerli statuses yok, işlem iptal.'
        );
        return;
      }

      const first = statuses[0];
      try {
        if (first.status) client.user.setStatus(first.status);
        else
          client.user.setActivity(first.name || first, {
            type: first.type || 'PLAYING',
          });
      } catch (e) {}

      client.statusLoopId = setInterval(() => {
        try {
          client._statusIndex = (client._statusIndex + 1) % statuses.length;
          const s = statuses[client._statusIndex];
          if (!s) return;
          try {
            if (s.status) client.user.setStatus(s.status);
            else
              client.user.setActivity(s.name || s, {
                type: s.type || 'PLAYING',
              });
          } catch (e) {}
        } catch (err) {
          console.error('[Ready] status loop hata:', err);
        }
      }, intervalMs);

      console.log(
        '[Ready] Varsayılan status döngüsü başlatıldı. interval:',
        intervalMs
      );
    } catch (err) {
      console.error('[Ready] startStatusLoop exception:', err);
    }
  };

  client.stopStatusLoop = () => {
    const cleared = safeClear('statusLoopId');
    if (cleared) console.log('[Ready] Varsayılan status döngüsü durduruldu.');
    else console.log('[Ready] Varsayılan status döngüsü yoktu.');
  };

  client.startCustomStatusLoop = (items = [], intervalMs = 5000) => {
    try {
      if (!Array.isArray(items) || items.length === 0) {
        console.log('[Ready] startCustomStatusLoop: boş liste, işlem iptal.');
        return;
      }

      safeClear('statusLoopId');
      client._statusIndex = 0;

      safeClear('customLoopId');
      client._customIndex = 0;

      const applyOne = (cur) => {
        if (!cur) return;
        try {
          if (cur.status) client.user.setStatus(cur.status);
          else
            client.user.setActivity(cur.name, {
              type: cur.type || 'PLAYING',
              url: cur.type === 'STREAMING' ? 'https://twitch.tv/' : undefined,
            });
        } catch (e) {}
      };

      applyOne(items[0]);

      client.customLoopId = setInterval(() => {
        try {
          client._customIndex = (client._customIndex + 1) % items.length;
          applyOne(items[client._customIndex]);
        } catch (err) {
          console.error('[Ready] custom status loop hata:', err);
        }
      }, intervalMs);

      console.log(
        '[Ready] Özel status döngüsü başlatıldı. interval:',
        intervalMs
      );
    } catch (err) {
      console.error('[Ready] startCustomStatusLoop exception:', err);
    }
  };

  client.stopCustomStatusLoop = () => {
    const cleared = safeClear('customLoopId');
    if (cleared) console.log('[Ready] Özel status döngüsü durduruldu.');
    else console.log('[Ready] Özel status döngüsü yoktu.');
  };

  client.resetStatusLoop = () => {
    try {
      client.stopCustomStatusLoop();
      client.startStatusLoop(client.defaultStatuses, 10000);
      console.log(
        '[Ready] Status döngüsü resetlendi (varsayılanlara dönüldü).'
      );
    } catch (err) {
      console.error('[Ready] resetStatusLoop hata:', err);
    }
  };

  client.checkStatusLoops = () => {
    console.log(
      '[Ready] checkStatusLoops => default:',
      !!client.statusLoopId,
      'custom:',
      !!client.customLoopId
    );
    return { default: !!client.statusLoopId, custom: !!client.customLoopId };
  };

  try {
    client.startStatusLoop(client.defaultStatuses, 10000);
  } catch (err) {
    console.error('[Ready] İlk status döngüsü başlatılamadı:', err);
  }
};
