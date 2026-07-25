function isRemoteUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function toPortableAnimeRecord(record) {
  const portableRecord = { ...record };
  delete portableRecord.localCoverUrl;
  delete portableRecord.displayCoverUrl;

  if (!isRemoteUrl(portableRecord.coverUrl)) {
    delete portableRecord.coverUrl;
  }

  return portableRecord;
}

function buildPortableExport(anime, watchHistory, exportedAt = new Date().toISOString()) {
  const portableAnime = anime.map(toPortableAnimeRecord);
  return {
    formatVersion: 2,
    exportedAt,
    anime: {
      count: portableAnime.length,
      records: portableAnime,
    },
    watchHistory: {
      count: watchHistory.length,
      records: watchHistory,
    },
  };
}

module.exports = {
  buildPortableExport,
  isRemoteUrl,
  toPortableAnimeRecord,
};
