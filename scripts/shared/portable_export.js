function isRemoteUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function toPortableAnimeRecord(record) {
  const portableRecord = { ...record };
  const noteEntries = Array.isArray(portableRecord.noteEntries)
    ? portableRecord.noteEntries
    : [];
  delete portableRecord.localCoverUrl;
  delete portableRecord.displayCoverUrl;
  delete portableRecord.noteEntries;

  if (!isRemoteUrl(portableRecord.coverUrl)) {
    delete portableRecord.coverUrl;
  }

  if (noteEntries.length > 0) {
    portableRecord.notes = noteEntries.map((note) => {
      const portableNote = { ...note };
      delete portableNote.animeId;
      return portableNote;
    });
  } else if (typeof portableRecord.notes === 'string' && portableRecord.notes.trim()) {
    portableRecord.notes = [{
      content: portableRecord.notes,
      notedAt: String(portableRecord.updatedAt || portableRecord.createdAt || '').slice(0, 10),
    }];
  } else {
    delete portableRecord.notes;
  }

  return portableRecord;
}

function buildPortableExport(anime, watchHistory, exportedAt = new Date().toISOString()) {
  const portableAnime = anime.map(toPortableAnimeRecord);
  return {
    formatVersion: 3,
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
