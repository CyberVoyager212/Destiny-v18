module.exports = function detectIssueType(err) {
  if (!err) return 'Unknown';
  const msg = (err && (err.code || err.message || String(err)))?.toString() || '';
  const stack = (err && err.stack) || '';
  const combined = (msg + '\n' + stack).toLowerCase();

  const patterns = [
    [/token|invalid authentication|401/, 'InvalidToken'],
    [/missing intents|privileged intents|intents required/, 'MissingIntents'],
    [/missing permission|missing perms|insufficient permission/, 'MissingPermissions'],
    [/rate limited|rate limit|429/, 'RateLimit'],
    [/gateway.*close|gateway.*disconnect/, 'GatewayDisconnect'],
    [/shard.*disconnect|shard.*resume|shard.*reconnect/, 'ShardDisconnect'],
    [/500|internal server error/, 'HTTP500'],
    [/unknown message|unknown message|Unknown Message/, 'UnknownMessage'],
    [/unknown user|unknown member|Unknown User/, 'UnknownUser'],
    [/unknown channel|Unknown Channel/, 'UnknownChannel'],
    [/cannot send embed|embeds? are disabled|missing embed permission/, 'MissingEmbedPermission'],
    [/message too long|max length/, 'MessageTooLong'],
    [/json.*parse|unexpected token in json|json parse error/, 'JSONParseError'],
    [/syntax error/, 'SyntaxError'],
    [/unhandled promise rejection|unhandledrejection/, 'UnhandledRejection'],
    [/uncaught exception|uncaughtexception/, 'UncaughtException'],
    [/mongo|mongodb|mongoose|db.*connection/, 'DatabaseConnectionFailed'],
    [/mongo network error|failed to connect to server.*on first connect/, 'MongoNetworkError'],
    [/voice|voice.*connection|opus|pcm|voice.*error/, 'VoiceConnectionError'],
    [/libopus|opusscript|opus/, 'OpusEngineError'],
    [/eacces|permission denied/, 'EACCES'],
    [/enotfound|getaddrinfo|dns lookup error/, 'ENOTFOUND'],
    [/timeout|timed out|ETIMEDOUT/, 'Timeout'],
    [/fetcherror|networkerror|failed to fetch|axios error/, 'FetchError'],
    [/axios|axioserror/, 'AxiosError'],
    [/discordapierror|discord api error/, 'DiscordAPIError'],
    [/too many requests|429/, 'TooManyRequests'],
    [/close 1006|ws close 1006/, 'WSClose1006'],
    [/close 4014|4014/, 'WSClose4014'],
    [/client.*destroy|client destroyed/, 'ClientDestroyed'],
    [/token revoked|token.*revok/, 'TokenRevoked'],
    [/command.*error|command handler|command failed/, 'CommandHandlerError'],
    [/event.*error|event handler/, 'EventHandlerError'],
    [/permission overwrite|overwrite.*error/, 'PermissionOverwriteError'],
    [/emoji not found|unknown emoji/, 'EmojiNotFound'],
    [/reaction.*error|reaction.*failed/, 'ReactionError'],
    [/cannot send messages to this user|cannot dm user|dm blocked/, 'DMBlocked'],
    [/file too large|attachment.*too large/, 'AttachmentTooLarge'],
    [/animestyle/, 'AnimestyleModuleError'],
  ];

  for (const [re, tag] of patterns) if (re.test(combined)) return tag;
  return 'Unknown';
};
