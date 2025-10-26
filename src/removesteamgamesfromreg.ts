#!/usr/bin/env bun

import { $ } from "bun";
import os from "node:os";

async function hasAdminRights(): Promise<boolean> {
  try {
    await $`net session`.quiet();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (os.platform() !== "win32") {
    console.error("❌ This script is designed to run only on Windows.");
    process.exit(1);
  }

  const isElevationAttempt = process.argv.includes("--elevated");
  const isAdmin = await hasAdminRights();

  if (!isAdmin) {
    if (isElevationAttempt) {
      console.error("❌ Failed to get administrator privileges. Aborting.");
      await Bun.sleep(5000);
      process.exit(1);
    }

    console.log("Requesting administrator permissions...");

    const bunExecutable = process.execPath || process.argv[0];
    const scriptPath = process.argv[1];

    const originalArgs = process.argv.slice(2).filter(arg => arg !== "--elevated");

    const psArgsArray = [scriptPath, "--elevated", ...originalArgs]
      .map(a => `'${String(a).replace(/'/g, "''")}'`)
      .join(",");

    const psCommand = `Start-Process -FilePath '${
      bunExecutable!.replace(/'/g, "''")
    }' -ArgumentList ${psArgsArray} -Verb RunAs`;

    try {
      const proc = Bun.spawn({
        cmd: ["powershell", "-NoProfile", "-Command", psCommand],
        stdout: "inherit",
        stderr: "inherit",
        stdin: "ignore",
      });

      const exitCode = await proc.exited;

      if (exitCode === 0) {
        process.exit(0);
      } else {
        console.error("❌ Elevation process exited with code", exitCode);
        process.exit(1);
      }
    } catch (err) {
      console.error("❌ Failed to start elevation process.", err);
      process.exit(1);
    }
  }

  console.log("✅ Running with administrator privileges.");

  const UNINSTALL_REG_PATHS: string[] = [
    "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKLM\\SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
  ];

  let entriesRemoved: number = 0;

  try {
    console.log("🔍 Searching for Steam App entries in the registry...");
    for (const regPath of UNINSTALL_REG_PATHS) {
      const queryOutput = await $`reg query ${regPath}`.text();
      const steamAppKeys = queryOutput
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.includes("Steam App"));

      if (steamAppKeys.length === 0) continue;

      console.log(`Found ${steamAppKeys.length} entries in ${regPath}.`);
      for (const key of steamAppKeys) {
        console.log(`  - Removing: ${key}`);
        await $`reg delete "${key}" /f`;
        entriesRemoved++;
      }
    }

    if (entriesRemoved > 0) {
      console.log(`\n✅ Successfully removed ${entriesRemoved} Steam App registry entries.`);
    } else {
      console.log("\n🟢 No Steam App registry entries found to remove.");
    }
  } catch (err) {
    console.error("\n❌ An error occurred during the script execution:", err);
    process.exit(1);
  } finally {
    console.log("\nScript complete. Exiting in 5 seconds...");
    await Bun.sleep(5000);
  }
}

main();
