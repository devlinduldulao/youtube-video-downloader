import express from "express";
import cors from "cors";
import ytdl from "@distube/ytdl-core";
import { homedir } from "os";
import { join } from "path";
import fs from "fs";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Determine Downloads folder based on OS
function getDownloadsFolder() {
  const platform = process.platform;
  const home = homedir();

  if (platform === "win32") {
    return join(home, "Downloads");
  } else if (platform === "darwin") {
    return join(home, "Downloads");
  } else {
    return join(home, "Downloads");
  }
}

// Get video info endpoint
app.post("/api/video-info", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    const info = await ytdl.getInfo(url);
    const formats = ytdl.filterFormats(info.formats, "videoandaudio");

    // Sort by quality (highest first)
    formats.sort((a, b) => {
      const qualityA = parseInt(a.qualityLabel) || 0;
      const qualityB = parseInt(b.qualityLabel) || 0;
      return qualityB - qualityA;
    });

    const highestQuality = formats[0];

    res.json({
      title: info.videoDetails.title,
      author: info.videoDetails.author.name,
      lengthSeconds: info.videoDetails.lengthSeconds,
      viewCount: info.videoDetails.viewCount,
      thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
      quality: highestQuality?.qualityLabel || "Unknown",
      videoId: info.videoDetails.videoId,
    });
  } catch (error) {
    console.error("Error fetching video info:", error);
    res.status(500).json({ error: "Failed to fetch video information" });
  }
});

// Download video endpoint
app.post("/api/download", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[^\w\s-]/g, "").trim();
    const filename = `${title}.mp4`;
    const downloadsFolder = getDownloadsFolder();
    const filePath = join(downloadsFolder, filename);

    // Check if downloads folder exists, create if not
    if (!fs.existsSync(downloadsFolder)) {
      fs.mkdirSync(downloadsFolder, { recursive: true });
    }

    // Get highest quality format with both video and audio
    const format = ytdl.chooseFormat(info.formats, { quality: "highestvideo", filter: "videoandaudio" });

    res.json({
      message: "Download started",
      filename,
      path: filePath,
      quality: format.qualityLabel || "Unknown",
    });

    // Start download
    const videoStream = ytdl(url, { format });
    const writeStream = fs.createWriteStream(filePath);

    videoStream.pipe(writeStream);

    writeStream.on("finish", () => {
      console.log(`✓ Download completed: ${filePath}`);
    });

    writeStream.on("error", (error) => {
      console.error("✗ Error writing file:", error);
    });
  } catch (error) {
    console.error("Error downloading video:", error);
    res.status(500).json({ error: "Failed to download video" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ONLINE", system: "YT_EXTRACT_v2.0" });
});

app.listen(PORT, () => {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  YT_EXTRACT SERVER v2.0`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  STATUS: ONLINE`);
  console.log(`  PORT: ${PORT}`);
  console.log(`  ENDPOINT: http://localhost:${PORT}`);
  console.log(`  DOWNLOAD_PATH: ${getDownloadsFolder()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});
