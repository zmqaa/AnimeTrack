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

function toPortableMangaRecord(record) {
  const portableRecord = { ...record };
  if (!isRemoteUrl(portableRecord.coverUrl)) delete portableRecord.coverUrl;
  return portableRecord;
}

function buildPortableExport(
  anime,
  watchHistory,
  exportedAt = new Date().toISOString(),
  manga = [],
  datasets = ['anime', 'manga'],
) {
  const includedDatasets = Array.from(new Set(datasets)).filter(
    (dataset) => dataset === 'anime' || dataset === 'manga',
  );
  const portableAnime = anime.map(toPortableAnimeRecord);
  const portableManga = manga.map(toPortableMangaRecord);
  const result = {
    formatVersion: 5,
    exportedAt,
    datasets: includedDatasets,
  };

  if (includedDatasets.includes('anime')) {
    result.anime = {
      count: portableAnime.length,
      records: portableAnime,
    };
    result.watchHistory = {
      count: watchHistory.length,
      records: watchHistory,
    };
  }

  if (includedDatasets.includes('manga')) {
    result.manga = {
      count: portableManga.length,
      records: portableManga,
    };
  }

  return result;
}

module.exports = {
  buildPortableExport,
  isRemoteUrl,
  toPortableAnimeRecord,
  toPortableMangaRecord,
};
