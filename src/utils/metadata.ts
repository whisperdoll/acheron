import { Song, SongMetadata } from "../Types";
import * as mm from "music-metadata";
import * as path from "path";
import * as fs from "fs";
import { bigintStatSync, getUserDataPath } from "../utils/utils";
import { SafeWriter } from "./safewriter";

const formats = [ ".mp3", ".m4a", ".wav", ".flac" ];

function loadCache(): Record<string, SongMetadata>
{
    const filePath = path.join(getUserDataPath(), "songcache.json");

    try
    {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
    catch
    {
        return {};
    }
}

export function saveCache(songs: Song[])
{
    const cache: Record<string, SongMetadata> = {};

    songs.forEach(song => cache[song.path] = song.metadata);

    SafeWriter.write(path.join(getUserDataPath(), "songcache.json"), JSON.stringify(cache), () =>
    {
        console.log("cache written");
    });
}

class MetadataLoader
{
    queue: string[] = [];
    songs: Song[] = [];
    n = 16;
    currentlyProcessing = 0;
    startedProcessing = 0;
    finishedProcessing = 0;

    constructor(private onFinish: (songs: Song[]) => any)
    {

    }

    enqueue(filePath: string)
    {
        this.queue.push(filePath);
    }

    start()
    {
        if (this.queue.length === 0)
        {
            this.onFinish(this.songs);
        }
        else
        {
            for (let i = 0; i < Math.min(this.queue.length, this.n); i++)
            {
                this.processNext();
            }
        }
    }

    private processNext()
    {
        if (this.startedProcessing >= this.queue.length) return;
        
        const filePath = this.queue[this.startedProcessing++];

        console.log("processing " + this.startedProcessing + "/" + this.queue.length);

        mm.parseFile(filePath, {
            duration: true
        }).then((metadata) =>
        {
            let src = "";
            const fid = bigintStatSync(filePath).ino.toString();

            if (metadata.common.picture && metadata.common.picture[0])
            {
                let format = metadata.common.picture[0].format;
                format = format.substr(format.indexOf("/") + 1);

                src = path.join(getUserDataPath(), fid + "." + format);

                SafeWriter.write(src, metadata.common.picture[0].data, (err) =>
                {
                    if (err) throw err;
                });
            }

            this.songs.push({
                path: filePath,
                fid,
                metadata: {
                    album: metadata.common.album || "",
                    artist: metadata.common.artist || "",
                    length: metadata.format.duration || 0,
                    modified: fs.statSync(filePath).mtimeMs,
                    picture: src,
                    plays: [],
                    title: metadata.common.title || "",
                    track: metadata.common.track.no ?? -1,
                }
            });

            this.finishedProcessing++;

            if (this.finishedProcessing === this.queue.length)
            {
                this.onFinish(this.songs);
            }
            else
            {
                this.processNext();
            }
        });
    }
}

/**
 * Will also create/update cache.
 * @param filePaths filepaths of the songs
 */
export function loadSongs(filePaths: string[], callback: (songs: Song[]) => any)
{
    console.time("loaded songs");
    const songs: Song[] = [];
    const cache = loadCache();
    const loader = new MetadataLoader((loadedSongs) =>
    {
        songs.push(...loadedSongs);
        saveCache(songs);
        callback(songs);
        console.timeEnd("loaded songs");
    });

    filePaths = filePaths.filter(filePath => formats.includes(path.extname(filePath)));

    filePaths.forEach((filePath) =>
    {
        if (Object.prototype.hasOwnProperty.call(cache, filePath))
        {
            songs.push({
                path: filePath,
                fid: bigintStatSync(filePath).ino.toString(),
                metadata: cache[filePath]
            });
        }
        else
        {
            loader.enqueue(filePath);
        }
    });

    console.log("songs found in cache: " + songs.length + "/" + filePaths.length);

    loader.start();
}