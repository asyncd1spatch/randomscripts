#!/usr/bin/env bun

import { $ } from "bun";
import os from "node:os";
import { createInterface } from "node:readline/promises";

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

    console.log("ℹ️ Administrator permissions required. Requesting elevation...");

    const bunExecutable = process.execPath;
    const scriptPath = process.argv[1];

    const originalArgs = process.argv.slice(2).filter(arg => arg !== "--elevated");

    const psArgsArray = [scriptPath, "--elevated", ...originalArgs]
      .map(a => `'${String(a).replace(/'/g, "''")}'`)
      .join(",");

    const psCommand = `Start-Process -FilePath '${
      bunExecutable.replace(/'/g, "''")
    }' -ArgumentList ${psArgsArray} -Verb RunAs`;

    try {
      const proc = Bun.spawn({
        cmd: ["powershell", "-NoProfile", "-Command", psCommand],
        stdout: "inherit",
        stderr: "inherit",
      });

      process.exit(await proc.exited);
    } catch (err) {
      console.error("❌ Failed to start elevation process.", err);
      process.exit(1);
    }
  }

  console.log("✅ Running with administrator privileges.");

  try {
    console.log("\n🔎 Checking for available updates via winget...");
    await $`cmd /c winget update`;

    console.log("\n🤔 Review the list of available updates above.");

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = (
      await rl.question(
        "Do you want to proceed with upgrading all packages? (y/n): ",
      )
    ).trim().toLowerCase();

    rl.close();

    if (answer === "y" || answer === "yes") {
      console.log("\n🚀 User confirmed. Proceeding with upgrade...");
      await $`cmd /c winget upgrade --all --accept-package-agreements --accept-source-agreements`;
      console.log("\n✅ Winget upgrade process finished.");
    } else {
      console.log("\n🛑 Upgrade cancelled by user. Exiting.");
      process.exit(0);
    }
  } catch (err) {
    console.error("\n❌ An error occurred during the winget process:", err);
    process.exit(1);
  } finally {
    console.log("\nScript complete. Exiting in 5 seconds...");
    await Bun.sleep(5000);
  }
}

main();
