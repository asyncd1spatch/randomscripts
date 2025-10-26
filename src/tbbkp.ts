#!/usr/bin/env bun

import { $ } from "bun";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";

const ORIGIN_DRIVE = "H:";
const ALLOWED_DEST_DRIVES = ["i", "z", "t", "w", "x"];
const ROBOCOPY_FLAGS = [
  "/MIR", // Mirror a directory tree (/E + /PURGE)
  "/R:1", // Retries on failed copies
  "/W:2", // Wait time between retries
  "/NFL", // No File List in log
  "/NDL", // No Directory List in log
];

const ROBOCOPY_SUCCESS_THRESHOLD = 8;

interface SyncTask {
  src: string;
  dest: string;
}

if (os.platform() !== "win32") {
  console.error("❌ This sync script is designed to run only on Windows.");
  process.exit(1);
}

const { SYSTEMDRIVE } = process.env;
if (!SYSTEMDRIVE) {
  console.error("❌ Error: Could not read SYSTEMDRIVE environment variable.");
  process.exit(1);
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const choice = (
  await rl.question(
    `Enter destination drive letter (${ALLOWED_DEST_DRIVES.join("/")}): `,
  )
).trim().toLowerCase();

if (!ALLOWED_DEST_DRIVES.includes(choice)) {
  console.error(`❌ Invalid selection "${choice}". Please choose from the allowed list.`);
  rl.close();
  process.exit(1);
}

const destDrive = `${choice.toUpperCase()}:`;
const originRoot = path.join(ORIGIN_DRIVE, path.sep);
const destRoot = path.join(destDrive, path.sep);

console.log("\n--- Sync Plan ---");
console.log(`Source Drive (Origin): ${originRoot}`);
console.log(`Source Drive (System): ${SYSTEMDRIVE}`);
console.log(`Destination Drive:     ${destRoot}`);
console.log(`Robocopy flags:        ${ROBOCOPY_FLAGS.join(" ")}`);

await rl.question("\nPress Enter to continue...");
rl.close();
console.log("");

try {
  const syncTasks: SyncTask[] = [
    { src: path.join(SYSTEMDRIVE, "unhome"), dest: path.join(destRoot, "unhome") },
    { src: path.join(SYSTEMDRIVE, "Steam"), dest: path.join(destRoot, "zMainSteam", "1") },
    { src: path.join(originRoot, "o"), dest: path.join(destRoot, "o") },
    { src: path.join(originRoot, "osiso"), dest: path.join(destRoot, "osiso") },
    { src: path.join(originRoot, "SteamLibrary"), dest: path.join(destRoot, "SteamLibrary") },
    { src: path.join(originRoot, "largedrivesonly"), dest: path.join(destRoot, "largedrivesonly") },
    { src: path.join(originRoot, "zhnt"), dest: path.join(destRoot, "zhnt") },
  ];

  console.log("🚀 Starting directory synchronization...");
  for (const task of syncTasks) {
    console.log(`Syncing: ${task.src} -> ${task.dest}`);

    const result = await $`robocopy ${task.src} ${task.dest} ${ROBOCOPY_FLAGS}`.nothrow();

    if (result.exitCode >= ROBOCOPY_SUCCESS_THRESHOLD) {
      console.error(`❌ Robocopy failed for source: ${task.src}`);
      throw result;
    }
  }

  console.log("\n✅ Drive synchronization completed successfully.");
} catch (err) {
  console.error("\n❌ Synchronization script failed:", err);
  process.exit(1);
}
